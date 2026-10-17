export async function showCamera(videoEl, stream) {
  videoEl.srcObject = stream;
  videoEl.setAttribute('playsinline', '');
  videoEl.muted = true;
  videoEl.style.display = 'block';
  try {
    await videoEl.play();
  } catch (e) {
    // autoplay can still be rejected; the stream is attached, so a later tap will start it
    const retry = () => videoEl.play().catch(() => {});
    window.addEventListener('pointerdown', retry, { once: true });
  }
}

export function stopCamera(videoEl) {
  const s = videoEl.srcObject;
  if (s) s.getTracks().forEach((t) => t.stop());
  videoEl.srcObject = null;
  videoEl.style.display = 'none';
}
