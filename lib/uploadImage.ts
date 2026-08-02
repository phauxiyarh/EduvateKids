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
 * Upload a freebie's downloadable file under freebies/{freebieId}/.
 *
 * Returns the storage PATH, not a URL: freebie files are not publicly readable,
 * and the download link is minted as a short-lived signed URL by a Cloud
 * Function once the visitor has subscribed. A public URL here would let anyone
 * skip the email gate by sharing the link.
 */
export async function uploadFreebieFile(file: File, freebieId: string): Promise<string> {
  const path = `freebies/${safeSegment(freebieId, 'item')}/${safeFileName(file)}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return path
}

/** Cover image for a freebie card. Public, unlike the file it advertises. */
export async function uploadFreebieCover(file: File, freebieId: string): Promise<string> {
  const path = `freebie-covers/${safeSegment(freebieId, 'item')}/${safeFileName(file)}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}
