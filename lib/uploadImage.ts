'use client'

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

/** Strip anything that could escape the intended folder or confuse Storage. */
const safeSegment = (value: string, fallback: string) =>
  (value || fallback).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || fallback

/** Deterministic-ish unique name without Math.random: size + cleaned filename. */
const safeFileName = (file: File) =>
  `${file.size}_${file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60)}`

/**
 * Upload a product image to Firebase Storage under catalog/{sku|id}/ and return
 * its public download URL. Used by the dashboard product form. Requires the
 * Storage rule allowing authenticated writes to catalog/** (see storage.rules).
 */
export async function uploadCatalogImage(file: File, keyPrefix: string): Promise<string> {
  const path = `catalog/${safeSegment(keyPrefix, 'misc')}/${safeFileName(file)}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}

/**
 * Upload a blog image under blog/{postId}/ and return its public URL. Publicly
 * readable like catalog images, since they are displayed on the article.
 */
export async function uploadBlogImage(file: File, postId: string): Promise<string> {
  const path = `blog/${safeSegment(postId, 'post')}/${safeFileName(file)}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}

/**
 * Cover image for a freebie card. This is the only thing we host for a
 * freebie: the resource itself is a Google Drive link the admin supplies.
 */
export async function uploadFreebieCover(file: File, freebieId: string): Promise<string> {
  const path = `freebie-covers/${safeSegment(freebieId, 'item')}/${safeFileName(file)}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}
