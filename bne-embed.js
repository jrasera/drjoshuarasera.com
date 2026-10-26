'use strict';
const experimentFrame = document.querySelector('.bne-embed iframe');
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== experimentFrame.contentWindow || event.data?.type !== 'bne-height') return;
  const height = Number(event.data.height);
  if (Number.isFinite(height) && height >= 400 && height <= 6000) experimentFrame.style.height = `${Math.ceil(height)}px`;
});
experimentFrame.addEventListener('load', () => experimentFrame.contentWindow.postMessage({type: 'bne-size-request'}, location.origin));
