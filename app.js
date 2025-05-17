document.addEventListener('DOMContentLoaded', () => {
    // Normal Mode Elements
    const normalModeContent = document.querySelectorAll('.normal-mode-content');
    const allCardsContainer = document.getElementById('allCardsContainer');
    const wishlistContainer = document.getElementById('wishlistContainer');
    const searchInput = document.getElementById('searchInput');
    const setFilterSelect = document.getElementById('setFilter');
    const rarityFilterSelect = document.getElementById('rarityFilter');
    const sortOptionsSelect = document.getElementById('sortOptions');
    const initialLoadingMessage = document.querySelector('.initial-loading-message');
    const loadingShimmerContainer = document.querySelector('.loading-shimmer');
    const emptyWishlistMessage = document.querySelector('#wishlistContainer .empty-message');
    const cardCountSpan = document.getElementById('cardCount');
    const wishlistCountSpan = document.getElementById('wishlistCount');
    const exportWishlistBtn = document.getElementById('exportWishlistBtn');
    const clearWishlistBtn = document.getElementById('clearWishlistBtn');
    const shareUrlContainer = document.getElementById('shareUrlContainer');
    const shareableUrlInput = document.getElementById('shareableUrl');
    const copyUrlBtn = document.getElementById('copyUrlBtn');

    // Shared View Mode Elements
    const sharedWishlistView = document.getElementById('sharedWishlistView');
    const sharedCardsContainer = document.getElementById('sharedCardsContainer');
    const loadingMessageShared = document.querySelector('.loading-message-shared');

    const API_URL = 'https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/v4.json';

    let allCardsData = [];
    let displayedCards = [];
    let wishlist = loadWishlist();
    let isViewMode = false;

    function enterViewMode() {
        isViewMode = true;
        document.body.classList.add('view-mode-active');
        sharedWishlistView.style.display = 'flex';
        normalModeContent.forEach(el => el.style.display = 'none');
        if (searchInput) searchInput.disabled = true;
        if (setFilterSelect) setFilterSelect.disabled = true;
        if (rarityFilterSelect) rarityFilterSelect.disabled = true;
        if (sortOptionsSelect) sortOptionsSelect.disabled = true;
    }

    async function checkForSharedWishlist() {
        const urlParams = new URLSearchParams(window.location.search);
        const sharedWishlistParam = urlParams.get('shared_wishlist');

        if (sharedWishlistParam) {
            enterViewMode();
            if (loadingMessageShared) loadingMessageShared.style.display = 'block';
            sharedCardsContainer.innerHTML = '';

            if (allCardsData.length === 0) {
                await fetchAllCards(true);
            }
            
            const sharedCardIds = sharedWishlistParam.split(',');
            let cardsToDisplayInSharedView = allCardsData.filter(card => sharedCardIds.includes(card.id));

            cardsToDisplayInSharedView.sort((a, b) => {
                const valA = (a.id || "z").toLowerCase();
                const valB = (b.id || "z").toLowerCase();
                if (valA < valB) return -1;
                if (valA > valB) return 1;
                return 0;
            });

            if (loadingMessageShared) loadingMessageShared.style.display = 'none';
            if (cardsToDisplayInSharedView.length > 0) {
                const fragment = document.createDocumentFragment();
                cardsToDisplayInSharedView.forEach(card => {
                    fragment.appendChild(createCardElement(card, false, true));
                });
                sharedCardsContainer.appendChild(fragment);
            } else {
                sharedCardsContainer.innerHTML = '<p class="empty-message">Could not find cards for this shared wishlist, or the list is empty.</p>';
            }
        } else {
            fetchAllCards();
            updateWishlistDisplayStates();
            initializeNormalModeEventListeners();
        }
    }

    function handleExportWishlist() {
        const wishlistIds = wishlist.map(card => card.id).join(',');
        const baseUrl = window.location.origin + window.location.pathname;
        const shareUrl = `${baseUrl}?shared_wishlist=${encodeURIComponent(wishlistIds)}`;
        shareableUrlInput.value = shareUrl;
        shareUrlContainer.style.display = 'block';
    }

    function copyShareUrlToClipboard() {
        shareableUrlInput.select();
        shareableUrlInput.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            copyUrlBtn.innerHTML = '<i class="fas fa-check"></i> Copied!'; // Icon feedback
            setTimeout(() => { copyUrlBtn.innerHTML = '<i class="fas fa-copy"></i> Copy URL'; }, 2000);
        } catch (err) {
            alert('Failed to copy URL. Please copy it manually.');
            console.error('Failed to copy URL: ', err);
        }
    }

    function handleClearWishlist() {
        if (wishlist.length === 0) return;
        if (window.confirm("Are you sure you want to clear your entire wishlist? This cannot be undone.")) {
            wishlist = [];
            saveWishlist();
            updateWishlistDisplayStates();
        }
    }

    function showLoadingState(isLoading) {
        if (isViewMode) return;
        if (isLoading) {
            if (loadingShimmerContainer) loadingShimmerContainer.style.display = 'grid';
            if (initialLoadingMessage) initialLoadingMessage.style.display = 'block';
            if (allCardsContainer) allCardsContainer.innerHTML = '';
            if (loadingShimmerContainer && allCardsContainer && allCardsContainer.children.length === 0) {
                 allCardsContainer.appendChild(loadingShimmerContainer);
            }
        } else {
            if (loadingShimmerContainer && loadingShimmerContainer.parentNode === allCardsContainer) {
                 if (allCardsContainer) allCardsContainer.removeChild(loadingShimmerContainer);
            } else if (loadingShimmerContainer) {
                loadingShimmerContainer.style.display = 'none';
            }
            if (initialLoadingMessage) initialLoadingMessage.style.display = 'none';
        }
    }
    
    async function fetchAllCards(forViewModeInit = false) {
        if (!forViewModeInit && isViewMode) return;
        if (!forViewModeInit) showLoadingState(true);
        try {
            const response = await fetch(API_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const rawData = await response.json();
            if (Array.isArray(rawData)) {
                allCardsData = rawData.filter(card => card && card.id && card.name);
            } else if (typeof rawData === 'object' && rawData !== null) {
                allCardsData = Object.values(rawData).flat().filter(card => card && card.id && card.name);
            } else {
                throw new Error("Unexpected API data format");
            }
            console.log(`Fetched ${allCardsData.length} cards.`);
            if (!isViewMode || forViewModeInit) {
                populateFilterDropdowns(allCardsData);
            }
            if (!isViewMode) {
                applyFiltersAndSort();
            }
        } catch (error) {
            console.error("Could not fetch Pokémon cards:", error);
            if (!isViewMode && allCardsContainer) {
                allCardsContainer.innerHTML = '<p class="empty-message">Oops! Could not load cards. Please try refreshing.</p>';
            } else if (isViewMode && sharedCardsContainer) {
                sharedCardsContainer.innerHTML = '<p class="empty-message">Error loading card data for shared list.</p>';
            }
        } finally {
            if (!forViewModeInit && !isViewMode) showLoadingState(false);
        }
    }

    function populateFilterDropdowns(cards) {
        if (isViewMode) return;
        if (setFilterSelect) {
            const packNames = new Set();
            cards.forEach(card => { if (card.pack) packNames.add(card.pack); });
            setFilterSelect.innerHTML = '<option value="all">All Packs</option>';
            Array.from(packNames).sort().forEach(packName => {
                const option = document.createElement('option');
                option.value = packName; option.textContent = packName;
                setFilterSelect.appendChild(option);
            });
        }
        if (rarityFilterSelect) {
            const rarities = new Set();
            cards.forEach(card => { if (card.rarity) rarities.add(card.rarity); });
            rarityFilterSelect.innerHTML = '<option value="all">All Rarities</option>';
            Array.from(rarities).sort().forEach(rarity => {
                const option = document.createElement('option');
                option.value = rarity; option.textContent = rarity;
                rarityFilterSelect.appendChild(option);
            });
        }
    }

    function applyFiltersAndSort() {
        if (isViewMode || !searchInput || !setFilterSelect || !rarityFilterSelect || !sortOptionsSelect) return;
        const searchTerm = searchInput.value.toLowerCase();
        const selectedPack = setFilterSelect.value;
        const selectedRarity = rarityFilterSelect.value;
        const sortValue = sortOptionsSelect.value;
        let filtered = [...allCardsData];
        if (selectedPack !== 'all') {
            filtered = filtered.filter(card => card.pack === selectedPack);
        }
        if (selectedRarity !== 'all') {
            filtered = filtered.filter(card => card.rarity === selectedRarity);
        }
        if (searchTerm) {
            filtered = filtered.filter(card =>
                card.name.toLowerCase().startsWith(searchTerm) ||
                (card.id && card.id.toLowerCase().includes(searchTerm))
            );
        }
        const [sortField, sortOrder] = sortValue.split('-');
        filtered.sort((a, b) => {
            let valA, valB;
            switch (sortField) {
                case 'name': valA = a.name.toLowerCase(); valB = b.name.toLowerCase(); break;
                case 'id': valA = (a.id || "z").toLowerCase(); valB = (b.id || "z").toLowerCase(); break;
                case 'rarity': valA = (a.rarity || "z").toLowerCase(); valB = (b.rarity || "z").toLowerCase(); break;
                default: return 0;
            }
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        displayedCards = filtered;
        renderAllCards(displayedCards);
        updateWishlistDisplayStates();
    }

    function createCardElement(card, isWishlistItem = false, isSharedViewItem = false) {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        if (!isSharedViewItem) cardDiv.dataset.cardId = card.id;

        const imageUrl = card.image || "";
        const cardInfoDiv = document.createElement('div');
        cardInfoDiv.classList.add('card-info');
        cardInfoDiv.innerHTML = `
            <h3>${card.name}</h3>
            <p><strong>Pack:</strong> ${card.pack || 'N/A'}</p>
            <p><strong>Rarity:</strong> ${card.rarity || 'N/A'}</p>
            <p><strong>ID:</strong> ${card.id}</p>
        `;
        const img = document.createElement('img');
        img.src = imageUrl; img.alt = card.name; img.loading = 'lazy';
        img.onerror = function() { this.style.display='none'; };

        cardDiv.appendChild(img);
        cardDiv.appendChild(cardInfoDiv);

        if (!isSharedViewItem) {
            const cardActionsDiv = document.createElement('div');
            cardActionsDiv.classList.add('card-actions');
            const button = document.createElement('button');
            if (isWishlistItem) {
                // Using Font Awesome icon for remove on wishlist item
                button.innerHTML = '<i class="fas fa-times"></i> Remove';
                button.classList.add('remove-btn');
                button.addEventListener('click', (e) => { e.stopPropagation(); removeFromWishlist(card.id); });
            } else {
                const isInWishlist = wishlist.some(wCard => wCard.id === card.id);
                if (isInWishlist) {
                    button.textContent = 'Added'; // Checkmark ::before pseudo-element added by CSS
                    button.classList.add('added-btn'); button.disabled = true;
                } else {
                    // Using Font Awesome icon for add
                    button.innerHTML = '<i class="fas fa-plus"></i> Add';
                    button.addEventListener('click', (e) => { e.stopPropagation(); addToWishlist(card); });
                }
            }
            cardActionsDiv.appendChild(button);
            cardDiv.appendChild(cardActionsDiv);
        }
        return cardDiv;
    }

    function renderAllCards(cardsToRender) {
        if (isViewMode || !allCardsContainer || !cardCountSpan || !initialLoadingMessage) return;
        allCardsContainer.innerHTML = '';
        cardCountSpan.textContent = `(${cardsToRender.length})`;
        if (cardsToRender.length === 0 && !initialLoadingMessage.style.display.includes('block')) {
            const message = (searchInput.value || setFilterSelect.value !== 'all' || rarityFilterSelect.value !== 'all')
                ? 'No cards match your filters. Try adjusting your search!'
                : 'No cards found in this collection.';
            allCardsContainer.innerHTML = `<p class="empty-message">${message}</p>`;
        } else if (cardsToRender.length > 0) {
            const fragment = document.createDocumentFragment();
            cardsToRender.forEach(card => fragment.appendChild(createCardElement(card, false, false)));
            allCardsContainer.appendChild(fragment);
        }
    }

    function updateWishlistDisplayStates() {
        if (isViewMode || !wishlistContainer || !wishlistCountSpan || !emptyWishlistMessage) return;
        wishlistContainer.innerHTML = '';
        wishlistCountSpan.textContent = `(${wishlist.length})`;
        const isListEmpty = wishlist.length === 0;
        if (isListEmpty) {
            emptyWishlistMessage.style.display = 'block';
        } else {
            emptyWishlistMessage.style.display = 'none';
            const fragment = document.createDocumentFragment();
            wishlist.forEach(card => fragment.appendChild(createCardElement(card, true, false)));
            wishlistContainer.appendChild(fragment);
        }
        if (exportWishlistBtn) exportWishlistBtn.disabled = isListEmpty;
        if (clearWishlistBtn) clearWishlistBtn.disabled = isListEmpty;
        if (isListEmpty && shareUrlContainer && shareUrlContainer.style.display !== 'none') {
            shareUrlContainer.style.display = 'none';
        }
        document.querySelectorAll('#allCardsContainer .card').forEach(cardElement => {
            const cardId = cardElement.dataset.cardId;
            const button = cardElement.querySelector('.card-actions button');
            if (button) {
                const isInWishlist = wishlist.some(wCard => wCard.id === cardId);
                if (isInWishlist) {
                    button.textContent = 'Added'; button.classList.add('added-btn'); button.disabled = true;
                } else {
                    button.innerHTML = '<i class="fas fa-plus"></i> Add';
                    button.classList.remove('added-btn'); button.disabled = false;
                }
            }
        });
    }

    function addToWishlist(card) {
        if (isViewMode) return;
        if (!wishlist.some(wCard => wCard.id === card.id)) {
            wishlist.push(card);
            saveWishlist();
            updateWishlistDisplayStates();
        }
    }

    function removeFromWishlist(cardId) {
        if (isViewMode) return;
        wishlist = wishlist.filter(card => card.id !== cardId);
        saveWishlist();
        updateWishlistDisplayStates();
    }

    function saveWishlist() {
        localStorage.setItem('pokemonTCGWishlistPro', JSON.stringify(wishlist));
    }

    function loadWishlist() {
        const stored = localStorage.getItem('pokemonTCGWishlistPro');
        return stored ? JSON.parse(stored) : [];
    }
    
    function initializeNormalModeEventListeners() {
        if (isViewMode) return;
        let searchTimeout;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(applyFiltersAndSort, 300);
            });
        }
        if (setFilterSelect) setFilterSelect.addEventListener('change', applyFiltersAndSort);
        if (rarityFilterSelect) rarityFilterSelect.addEventListener('change', applyFiltersAndSort);
        if (sortOptionsSelect) sortOptionsSelect.addEventListener('change', applyFiltersAndSort);
        if (exportWishlistBtn) exportWishlistBtn.addEventListener('click', handleExportWishlist);
        if (clearWishlistBtn) clearWishlistBtn.addEventListener('click', handleClearWishlist);
        if (copyUrlBtn) copyUrlBtn.addEventListener('click', copyShareUrlToClipboard);
    }

    checkForSharedWishlist();
});