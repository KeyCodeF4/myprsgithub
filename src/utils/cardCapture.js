import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { trackEvent } from './product-analytics';

export const SHARE_FORMATS = {
  story: { key: 'story', label: 'Story (9:16)', w: 1080, h: 1920, mime: 'image/png' },
  feed: { key: 'feed', label: 'Feed (1:1)', w: 1080, h: 1080, mime: 'image/png' },
  original: { key: 'original', label: 'Full Card', w: null, h: null, mime: 'image/png' },
};

export async function captureCardSnapshot(cardRef, format) {
  const fmt = SHARE_FORMATS[format] || SHARE_FORMATS.original;
  await new Promise(resolve => requestAnimationFrame(resolve));
  const uri = await captureRef(cardRef, {
    format: 'png',
    quality: 1,
    ...(fmt.w ? { width: fmt.w } : {}),
    ...(fmt.h ? { height: fmt.h } : {}),
  });
  return uri;
}

export async function shareSnapshot(uri, format) {
  const fmt = SHARE_FORMATS[format] || SHARE_FORMATS.original;
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: fmt.mime, dialogTitle: 'Share your MyPRS Wrapped' });
  trackEvent('wrapped.shared', { format });
}
