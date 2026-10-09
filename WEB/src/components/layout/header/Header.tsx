import UserProfile from "./UserProfile";
import { HEADER_SLOT_ID } from "./headerSlot";

export default function Header() {
  return (
    <div className="flex items-center gap-6 py-4 px-8 sm:px-6">
      <div className="flex shrink-0 items-center">
        {/*<img src="/logo.png" alt="Logo" className="h-8 w-8" />*/}
        <span className="ml-3 text-xl font-bold tracking-tight text-gray-900">
          CWA
        </span>
        <div className="grow" />

        <UserProfile />

      </div>
      {/* Pages can portal their own controls in here; the board puts its toolbar in it. */}
      <div id={HEADER_SLOT_ID} className="min-w-0 flex-1" />
    </div>
  )
}

