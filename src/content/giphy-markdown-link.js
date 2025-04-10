(function() {
  const extensionName = 'giphy-markdown-link-extension';
  const dataGiphyLink = `data-${extensionName}-giphy-link`;
  const dataGiphyAlt = `data-${extensionName}-giphy-alt`;
  const className = `${extensionName}`;

  function createMarkdownLink(giphyId, giphyAlt, popup) {
    const markdownLink = document.createElement('a');
    markdownLink.innerText = 'M';
    markdownLink.setAttribute(dataGiphyLink, giphyId);
    markdownLink.setAttribute(dataGiphyAlt, giphyAlt);
    markdownLink.className = className;
    markdownLink.addEventListener('click', function (event) {
      handleMarkdownLinkClick(this, popup, event);
    });
    return markdownLink;
  }

  function handleMarkdownLinkClick(linkElement, popup, event) {
    const giphyId = linkElement.getAttribute(dataGiphyLink);
    const giphyAlt = linkElement.getAttribute(dataGiphyAlt);
    navigator.clipboard.writeText(`![${giphyAlt}](https://media.giphy.com/media/${giphyId}/giphy.gif)`);
    event.preventDefault();
    event.stopPropagation();

    showPopup(popup);
  }

  function showPopup(popup) {
    popup.classList.add('active');
    setTimeout(() => {
      popup.classList.remove('active');
    }, 5000);
  }

  function processGifElement(gifElement, popup) {
    const giphyId = gifElement.getAttribute('data-giphy-id');
    const giphyImgElement = gifElement.querySelector('.giphy-gif-img');
    const giphyAlt = giphyImgElement ? giphyImgElement.getAttribute('alt') : '';
    const markdownLink = createMarkdownLink(giphyId, giphyAlt, popup);

    console.info('process Gif Element '+giphyId);
    if (gifElement.querySelectorAll(`[class="${className}"]`).length < 1) {
      gifElement.insertAdjacentElement('afterbegin', markdownLink);
    }
  }

  function init() {
    console.info('init giphy markdown link');
    const popup = createPopup();
    document.body.appendChild(popup);

    const giphyBody = document.querySelector('body');
    if (!giphyBody) {
      return;
    }

    setTimeout(() => {
      processExistingGifs(giphyBody, popup);
      observeNewGifs(giphyBody, popup);
    }, 1000);
  }

  function createPopup() {
    const popup = document.createElement('div');
    popup.className = 'giphy-markdown-link-extension-message text-giphyWhite flex items-center justify-center p-2.5 text-center font-bold bg-gradient-warning';
    popup.textContent = 'Markdown copied to clipboard!';
    return popup;
  }

  function processExistingGifs(giphyBody, popup) {
    console.group('process Existing Gifs');
    const existingGifs = giphyBody.querySelectorAll('[data-giphy-id]');
    existingGifs.forEach((gifElement) => {
      processGifElement(gifElement, popup);
    });
    console.groupEnd();
  }

  function observeNewGifs(giphyBody, popup) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(({addedNodes}) => {
        addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('giphy-gif')) {
            processGifElement(node, popup);
          }
        });
      });
    });
    observer.observe(giphyBody, {childList: true, subtree: true});
  }

  init();
})();
