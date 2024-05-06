(() => {
    const extensionName = 'giphy-markdown-link-extension';
    const dataGiphyLink = `data-${extensionName}-giphy-link`;
    const dataGiphyAlt = `data-${extensionName}-giphy-alt`;
    const className = `${extensionName}`;

    function processGifElement(gifElement, popup) {
        const giphyId = gifElement.getAttribute('data-giphy-id');
        const giphyImgElement = gifElement.querySelector('.giphy-gif-img');
        const giphyAlt = giphyImgElement ? giphyImgElement.getAttribute('alt') : '';
        const markdownLink = document.createElement('a');
        markdownLink.innerText = 'M';
        markdownLink.setAttribute(dataGiphyLink, giphyId);
        markdownLink.setAttribute(dataGiphyAlt, giphyAlt);
        markdownLink.className = className;
        markdownLink.addEventListener('click', function (event) {
            const giphyId = this.getAttribute(dataGiphyLink);
            const giphyAlt = this.getAttribute(dataGiphyAlt);
            navigator.clipboard.writeText(`![${giphyAlt}](https://media.giphy.com/media/${giphyId}/giphy.gif)`);
            event.preventDefault();
            event.stopPropagation();

            popup.classList.add('active');
            setTimeout(() => {
                popup.classList.remove('active');
            }, 5000);
        });
        if (gifElement.querySelectorAll(`[class="${className}"]`).length < 1) {
            gifElement.insertAdjacentElement('afterbegin', markdownLink);
        }
    }

    (() => {
        const popup = document.createElement('div');
        popup.className = 'giphy-markdown-link-extension-message text-giphyWhite flex items-center justify-center p-2.5 text-center font-bold bg-gradient-warning';
        popup.textContent = 'Markdown copied to clipboard!';
        document.body.appendChild(popup);

        const giphyGrid = document.querySelector('.giphy-grid');
        if (!giphyGrid) {
            return;
        }

        setTimeout(() => {
            // Process existing .giphy-gif elements
            const existingGifs = giphyGrid.querySelectorAll('.giphy-gif');
            existingGifs.forEach((gifElement) => {
                processGifElement(gifElement, popup);
            });

            const observer = new MutationObserver((mutations) => {
                mutations.forEach(({addedNodes}) => {
                    addedNodes.forEach((node) => {
                        // Check if the added node is an Element and has the class 'giphy-gif'
                        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('giphy-gif')) {
                            // Process the gif element
                            processGifElement(node, popup);
                        }
                    });
                });
            });
            observer.observe(giphyGrid, {childList: true, subtree: true});
        }, 1000);
    })();
})();