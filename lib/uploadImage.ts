'use client'

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

/**
 * Upload a product image to Firebase Storage under catalog/{sku|id}/ and return
 * its public download URL. Used by the dashboard product form. Requires the
 * Storage rule allowing authenticated writes to catalog/** (see storage.rules).
 */
export async function uploadCatalogImage(file: File, keyPrefix: string): Promise<string> {
  const safePrefix = (keyPrefix || 'misc').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'misc'
  // Deterministic-ish unique name without Math.random (name from size + cleaned filename).
  const cleanName = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(-60)
  const path = `catalog/${safePrefix}/${file.size}_${cleanName}`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file, { contentType: file.type })
  return getDownloadURL(storageRef)
}
