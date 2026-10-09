'use server'

import { redirect } from 'next/navigation'

export default async function navigateToRoomAction(formData: FormData) {
  const id = formData.get('id')
  // const secret = formData.get('secret')

  if (typeof id !== 'string' || !id.trim()) {
    return
  }

  // if (typeof secret !== 'string' || !secret.trim()) {
  //   redirect(`/room/${encodeURIComponent(id.trim())}`)
  // }
  // else {
  //   redirect(`/room/${encodeURIComponent(id.trim())}?secret=${encodeURIComponent(secret.trim())}`)
  // }

  redirect(`/room/${encodeURIComponent(id.trim())}`)
}
