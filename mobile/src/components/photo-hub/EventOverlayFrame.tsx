import { useState } from 'react';
import { View, Image, type LayoutChangeEvent } from 'react-native';
import type { EventOverlayArtwork } from '@/lib/overlays/event-overlay';

/**
 * Draws the event's real overlay artwork on the phone.
 *
 * Two shapes of artwork, both handled here so the phone matches what the server
 * will produce:
 *  - "frame": a polaroid whose middle window the photo is dropped into. The
 *    artwork is drawn around a see-through window so the guest can be lined up
 *    inside it. Drawn as four clipped bands rather than one image, because an
 *    opaque frame (a JPG) would otherwise hide the camera completely.
 *  - "overlay": art laid over the whole photo, so it is simply drawn on top.
 */

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the artwork and its window land inside a box of the given size. */
function fitArtwork(
  artwork: EventOverlayArtwork,
  boxWidth: number,
  boxHeight: number
): { frame: Rect; window: Rect } | null {
  const artWidth = artwork.width ?? 0;
  const artHeight = artwork.height ?? 0;
  const window = artwork.window;

  if (artWidth <= 0 || artHeight <= 0 || boxWidth <= 0 || boxHeight <= 0 || !window) {
    return null;
  }

  // Whole frame visible, centred (contain).
  const scale = Math.min(boxWidth / artWidth, boxHeight / artHeight);
  const frame: Rect = {
    width: artWidth * scale,
    height: artHeight * scale,
    left: (boxWidth - artWidth * scale) / 2,
    top: (boxHeight - artHeight * scale) / 2,
  };

  return {
    frame,
    window: {
      left: frame.left + window.x * frame.width,
      top: frame.top + window.y * frame.height,
      width: window.w * frame.width,
      height: window.h * frame.height,
    },
  };
}

/** One slice of the artwork, clipped to `band`. */
function ArtworkBand({ url, frame, band }: { url: string; frame: Rect; band: Rect }) {
  if (band.width <= 0.5 || band.height <= 0.5) return null;

  return (
    <View
      style={{
        position: 'absolute',
        left: band.left,
        top: band.top,
        width: band.width,
        height: band.height,
        overflow: 'hidden',
      }}
    >
      <Image
        source={{ uri: url }}
        style={{
          position: 'absolute',
          left: frame.left - band.left,
          top: frame.top - band.top,
          width: frame.width,
          height: frame.height,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}

/** The artwork with a see-through hole where the photo goes. */
function FrameWithWindow({
  artwork,
  frame,
  window,
}: {
  artwork: EventOverlayArtwork;
  frame: Rect;
  window: Rect;
}) {
  const frameRight = frame.left + frame.width;
  const frameBottom = frame.top + frame.height;
  const windowRight = window.left + window.width;
  const windowBottom = window.top + window.height;

  return (
    <>
      <ArtworkBand
        url={artwork.url}
        frame={frame}
        band={{ left: frame.left, top: frame.top, width: frame.width, height: window.top - frame.top }}
      />
      <ArtworkBand
        url={artwork.url}
        frame={frame}
        band={{ left: frame.left, top: windowBottom, width: frame.width, height: frameBottom - windowBottom }}
      />
      <ArtworkBand
        url={artwork.url}
        frame={frame}
        band={{ left: frame.left, top: window.top, width: window.left - frame.left, height: window.height }}
      />
      <ArtworkBand
        url={artwork.url}
        frame={frame}
        band={{ left: windowRight, top: window.top, width: frameRight - windowRight, height: window.height }}
      />
    </>
  );
}

/**
 * Live camera guide: the event's artwork over the viewfinder, with the camera
 * showing through the window so staff can see exactly where the guest has to
 * stand. Everything outside the artwork is dimmed to make the shot obvious.
 */
export function EventOverlayGuide({ artwork }: { artwork: EventOverlayArtwork }) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  const fitted = size ? fitArtwork(artwork, size.width, size.height) : null;

  return (
    <View
      onLayout={onLayout}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {artwork.mode === 'overlay' ? (
        <Image
          source={{ uri: artwork.url }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          resizeMode="contain"
        />
      ) : fitted ? (
        <>
          {/* Dim the parts of the viewfinder that will not be in the photo. */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: fitted.frame.top,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: fitted.frame.top + fitted.frame.height,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.55)',
            }}
          />
          <FrameWithWindow artwork={artwork} frame={fitted.frame} window={fitted.window} />
        </>
      ) : null}
    </View>
  );
}

/**
 * What the finished photo will look like: the captured shot dropped into the
 * artwork's window, exactly as the server composites it.
 */
export function FramedPhotoPreview({
  artwork,
  photoUri,
}: {
  artwork: EventOverlayArtwork;
  photoUri: string;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height }
    );
  };

  const fitted = size ? fitArtwork(artwork, size.width, size.height) : null;

  return (
    <View
      onLayout={onLayout}
      style={{ flex: 1, overflow: 'hidden' }}
    >
      {artwork.mode === 'overlay' ? (
        <>
          <Image
            source={{ uri: photoUri }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="contain"
          />
          <Image
            source={{ uri: artwork.url }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            resizeMode="contain"
          />
        </>
      ) : fitted ? (
        <>
          {/* Photo first, clipped to the window, then the artwork around it. */}
          <View
            style={{
              position: 'absolute',
              left: fitted.window.left,
              top: fitted.window.top,
              width: fitted.window.width,
              height: fitted.window.height,
              overflow: 'hidden',
              backgroundColor: '#000',
            }}
          >
            <Image
              source={{ uri: photoUri }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          </View>
          <FrameWithWindow artwork={artwork} frame={fitted.frame} window={fitted.window} />
        </>
      ) : (
        <Image
          source={{ uri: photoUri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
