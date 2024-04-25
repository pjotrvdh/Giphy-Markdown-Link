(() => {
    let extensionName = 'giphy-markdown-link-extension';
    let dataGiphyLink = `data-${extensionName}-giphy-link`;
    let dataGiphyAlt = `data-${extensionName}-giphy-alt`;
    let className = `${extensionName}`;

    // Function to add markdown links to giphy gifs
    (() => {
        setTimeout(() => {
            let giphyGifs = document.querySelectorAll(".giphy-gif");
            let popup = document.createElement('div');
            popup.className = 'giphy-markdown-link-extension-message text-giphyWhite flex items-center justify-center p-2.5 text-center font-bold bg-gradient-warning';
            popup.textContent = 'Markdown copied to clipboard!';
            document.body.appendChild(popup);

            giphyGifs.forEach((gifElement) => {
                let giphyId = gifElement.getAttribute('data-giphy-id');
                let giphyImgElement = gifElement.querySelector('.giphy-gif-img');
                let giphyAlt = giphyImgElement ? giphyImgElement.getAttribute('alt') : '';
                let markdownLink = document.createElement('a');
                markdownLink.innerText = 'M';
                markdownLink.setAttribute(dataGiphyLink, giphyId);
                markdownLink.setAttribute(dataGiphyAlt, giphyAlt);
                markdownLink.className = className;
                markdownLink.addEventListener('click', function (event) {
                    let giphyId = this.getAttribute(dataGiphyLink);
                    let giphyAlt = this.getAttribute(dataGiphyAlt);
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
            });
        }, 2000);
    })();
})();