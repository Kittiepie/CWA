"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { BoardElement, ChatCoordinate, ChatMessage, ElementType, Op, Presence } from "@/types/board";
import { BoardTransport, type DatagramHandler } from "@/lib/board/webtransportClient";

export type BoardElementsById = Record<string, BoardElement>;
/** Everyone in the room right now, keyed by the clientId their datagrams carry. */
export type PresenceByClientId = Record<string, Presence>;
export type ConnectionState = "connecting" | "connected" | "error";
export type OpHandler = (op: Op) => void;

interface LoadingElement {
    id: string;
    type?: ElementType;
    deleted: boolean;
    data: Record<string, unknown>;
}

interface UseBoardTransportOptions {
    url: string;
    certHashBase64: string | null;
    /** Which room to join — see server.ts: this rides along on the GET_STATE request. */
    roomId: string;
    /** Identifies us to the server, which resolves our name/theme from it for chat and presence. */
    participantId: string | null;
}

interface UseBoardTransportResult {
    elements: BoardElementsById;
    /** Exposed directly so the canvas can apply optimistic local updates while dragging/drawing. */
    setElements: Dispatch<SetStateAction<BoardElementsById>>;
    sendOp: (elementId: string, field: string, value: unknown, type?: ElementType) => void;
    sendDatagram: (payload: unknown) => void;
    onDatagram: (handler: DatagramHandler) => () => void;
    /** Raw incoming ops, for anything that needs more than the merged `elements` state (e.g. clearing a remote draft when its owner commits). */
    onOp: (handler: OpHandler) => () => void;
    /** The room's conversation, oldest first — history on join plus live pushes. */
    chatMessages: ChatMessage[];
    sendChat: (content: string, coordinate: ChatCoordinate | null) => void;
    /** Who's in the room, ourselves included. */
    participants: PresenceByClientId;
    connectionState: ConnectionState;
    clientId: string | null;
}

/**
 * Bridges BoardTransport (plain WebTransport wrapper, no React/Konva
 * knowledge) into React state. Mirrors what `index.html`'s `main()` used to
 * do inline: connect, join a room + load its initial state, apply pushed
 * ops as they arrive.
 */
export function useBoardTransport({ url, certHashBase64, roomId, participantId }: UseBoardTransportOptions): UseBoardTransportResult {
    const transportRef = useRef<BoardTransport | null>(null);
    const [elements, setElements] = useState<BoardElementsById>({});
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [participants, setParticipants] = useState<PresenceByClientId>({});
    const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
    const [clientId, setClientId] = useState<string | null>(null);

    const participantIdRef = useRef(participantId);
    useEffect(() => {
        participantIdRef.current = participantId;
    }, [participantId]);

    // Subscriber sets for external consumers (BoardCanvas) of onOp/onDatagram.
    // These exist from the very first render, NOT created inside the connect
    // effect below — specifically so a CHILD component's effect can subscribe
    // successfully no matter which effect happens to run first. React fires a
    // child's effects before its parent's on mount, so BoardCanvas subscribing
    // via onOp/onDatagram in its own effect can run BEFORE this hook's own
    // connect effect has even constructed a BoardTransport — subscribing
    // straight against `transportRef.current` at that moment would silently
    // attach to `null` (lost forever, no error, since every call site here is
    // optional-chained). Routing through these ref-based Sets instead
    // decouples "when something subscribes" from "when the transport exists":
    // the connect effect forwards into whatever's registered here once data
    // actually starts arriving, regardless of subscribe-vs-connect ordering.
    const opHandlersRef = useRef<Set<OpHandler>>(new Set());
    const datagramHandlersRef = useRef<Set<DatagramHandler>>(new Set());

    const applyOp = useCallback((op: Op) => {
        setElements((prev) => {
            const existing = prev[op.elementId];
            if (op.field === "deleted") {
                if (!existing) return prev; // xoá 1 phần tử ta chưa từng thấy — bỏ qua
                return { ...prev, [op.elementId]: { ...existing, deleted: op.value } };
            }
            const base = existing ?? ({ id: op.elementId, type: op.type, deleted: false, data: {} } as BoardElement);
            const merged = {
                ...base,
                type: op.type,
                data: { ...base.data, [op.field]: op.value },
            } as BoardElement;
            return { ...prev, [op.elementId]: merged };
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        // Nếu đây là chuyển phòng (không phải lần mount đầu), đừng để phần tử
        // của phòng cũ còn hiện trên màn hình trong lúc phòng mới đang tải.
        setElements({});
        setChatMessages([]);
        setParticipants({});
        setConnectionState("connecting");

        const transport = new BoardTransport();
        transportRef.current = transport;
        setClientId(transport.clientId);

        const unsubscribeOp = transport.onOp((op) => {
            if (cancelled) return;
            applyOp(op);
            opHandlersRef.current.forEach((h) => h(op));
        });
        const unsubscribeDatagram = transport.onDatagram((payload) => {
            if (cancelled) return;
            datagramHandlersRef.current.forEach((h) => h(payload));
        });
        const unsubscribeChat = transport.onChat((message) => {
            if (cancelled) return;
            // The server echoes our own messages back too, so guard against a
            // duplicate if a push ever races the history we loaded on join.
            setChatMessages((prev) =>
                prev.some((m) => m.id === message.id) ? prev : [...prev, message],
            );
        });
        const unsubscribePresence = transport.onPresence((message) => {
            if (cancelled) return;
            setParticipants((prev) => {
                if (message.event === "join") {
                    return { ...prev, [message.participant.clientId]: message.participant };
                }
                if (!(message.clientId in prev)) return prev;
                const next = { ...prev };
                delete next[message.clientId];
                return next;
            });
        });

        (async () => {
            try {
                await transport.connect(url, certHashBase64);
                // Unmounted mid-handshake: the session is already being torn
                // down, so asking it for state would only throw.
                if (cancelled) return;
                const state = await transport.loadState(roomId, participantIdRef.current);
                if (cancelled) return;

                const loading: Record<string, LoadingElement> = {};
                for (const [hashField, entry] of Object.entries(state.board)) {
                    const sep = hashField.indexOf(":");
                    const id = hashField.slice(0, sep);
                    const field = hashField.slice(sep + 1);
                    const current: LoadingElement = loading[id] ?? { id, deleted: false, data: {} };
                    if (field === "__type") current.type = entry.value as ElementType;
                    else if (field === "deleted") current.deleted = entry.value as boolean;
                    else current.data[field] = entry.value;
                    loading[id] = current;
                }

                const loaded: BoardElementsById = {};
                for (const el of Object.values(loading)) {
                    if (!el.type) continue; // chưa nhận đủ field để biết type — hiếm khi xảy ra, bỏ qua
                    loaded[el.id] = { id: el.id, type: el.type, deleted: el.deleted, data: el.data } as BoardElement;
                }
                setElements(loaded);
                setChatMessages(state.chat);
                // Merged under anything already pushed: someone else's join can
                // arrive while this reply is still in flight.
                const present = Object.fromEntries(state.participants.map((p) => [p.clientId, p]));
                setParticipants((prev) => ({ ...present, ...prev }));
                setConnectionState("connected");
            } catch (err) {
                console.error("useBoardTransport: connect/loadState failed", err);
                if (!cancelled) setConnectionState("error");
            }
        })();

        return () => {
            cancelled = true;
            unsubscribeOp();
            unsubscribeDatagram();
            unsubscribeChat();
            unsubscribePresence();
            transport.close();
            transportRef.current = null;
        };
        // reconnect only if the endpoint or room itself changes
    }, [url, certHashBase64, roomId, applyOp]);

    const sendOp = useCallback((elementId: string, field: string, value: unknown, type?: ElementType) => {
        transportRef.current?.sendOp(elementId, field, value, type).catch((err) => console.error("sendOp failed", err));
    }, []);

    const sendDatagram = useCallback((payload: unknown) => {
        transportRef.current?.sendDatagram(payload).catch(() => { });
    }, []);

    const onDatagram = useCallback((handler: DatagramHandler) => {
        datagramHandlersRef.current.add(handler);
        return () => datagramHandlersRef.current.delete(handler);
    }, []);

    const onOp = useCallback((handler: OpHandler) => {
        opHandlersRef.current.add(handler);
        return () => opHandlersRef.current.delete(handler);
    }, []);

    const sendChat = useCallback((content: string, coordinate: ChatCoordinate | null) => {
        const participantId = participantIdRef.current;
        if (!participantId) return; // not authenticated yet — the server would reject it anyway
        transportRef.current
            ?.sendChat(participantId, content, coordinate)
            .catch((err) => console.error("sendChat failed", err));
    }, []);

    return {
        elements,
        setElements,
        sendOp,
        sendDatagram,
        onDatagram,
        onOp,
        chatMessages,
        sendChat,
        participants,
        connectionState,
        clientId,
    };
}
