import { redirect } from "next/navigation";

// The landing page lives at /room. Redirecting on the server sends visitors
// there before anything renders, so there's no flash of an empty page.
export default function Home() {
  redirect("/room");
}
