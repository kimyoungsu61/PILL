(() => {
  'use strict';
  // Share only the public guide URL, never the current query, hash, or account state.
  const shareUrl = 'https://pill-web-production.up.railway.app/install.html';
  const link = document.getElementById('share-link');
  const status = document.getElementById('share-status');
  const shareButton = document.getElementById('share-button');
  const copyButton = document.getElementById('copy-button');
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  if (installed) {
    document.getElementById('installed-notice').hidden = false;
    document.getElementById('start-link').firstChild.textContent = 'PILL 열기 ';
  } else if (/KAKAOTALK|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent)) {
    document.getElementById('browser-notice').hidden = false;
  }

  function selectLink() {
    link.focus();
    link.select();
    link.setSelectionRange(0, link.value.length);
  }

  async function copyLink() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareUrl);
      status.textContent = '링크를 복사했어요. 카카오톡이나 메시지에 붙여 넣어 주세요.';
    } catch {
      selectLink();
      status.textContent = '링크를 길게 눌러 복사한 뒤 친구에게 보내 주세요.';
    }
  }

  copyButton.addEventListener('click', copyLink);
  shareButton.addEventListener('click', async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: 'PILL · 영양제와 복용 루틴',
        text: 'PILL에서 영양제와 복용 시간을 함께 챙겨요. 링크를 열면 홈 화면 설치 방법도 볼 수 있어요.',
        url: shareUrl,
      });
      status.textContent = '';
    } catch (error) {
      if (error?.name === 'AbortError') return;
      status.textContent = '공유가 열리지 않았어요. 링크 복사로 보내 주세요.';
    }
  });
})();
