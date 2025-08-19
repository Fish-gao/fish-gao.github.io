// script.js
document.addEventListener('DOMContentLoaded', async () => {
    // DOM Element References
    const sunArea = document.getElementById('sun-area');
    const splashScreen = document.getElementById('splash-screen');
    const loadingScreen = document.getElementById('loading-screen');
    const mainContent = document.getElementById('main-content');
    const qianContent = document.getElementById('qian-content');
    const resultBox = document.querySelector('.result-box');
    const drawBtn = document.getElementById('draw-btn');
    const shareBtn = document.getElementById('share-btn'); // New Share Button
    const actionBtns = document.querySelectorAll('.action-btn');
    const btnExample = document.getElementById('btn-example');
    const langSwitcherBtns = document.querySelectorAll('.lang-btn');
    const splashTextOverlay = document.getElementById('splash-text-overlay');

    // Image Preview Modal Elements
    const imagePreviewModal = document.getElementById('image-preview-modal');
    const closePreviewModalBtn = document.getElementById('close-preview-modal');
    const previewImageElement = document.getElementById('preview-image');
    const shareImageRenderContainer = document.getElementById('share-image-render-container');


    // State Variables
    let currentSign = null;
    let currentLang = 'zh'; // Default language
    let translations = {};   // Store UI translations
    let signDataStore = {}; // Store sign data for different languages
    let globalAudio = null; // Global audio object for mantra playback
    let textOverlayTimeoutId = null; // Timeout ID for text overlay animation cleanup
    let isDataLoading = false; // Flag to prevent multiple simultaneous data loads
    let dataLoadPromise = null; // Promise for ongoing data load
    let currentUserRequest = ''; // Store the user's request

    // --- Language Handling Core Functions ---

    /**
     * Loads UI translation file (lang/xx.json) for the specified language.
     * Falls back to Chinese ('zh') if the requested language file fails to load.
     * @param {string} lang - Language code (e.g., 'zh', 'en').
     * @returns {Promise<object>} The translations object.
     */
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`lang/${lang.toLowerCase()}.json?v=${new Date().getTime()}`);
            if (!response.ok) {
                console.warn(`Translations for ${lang} not found or failed to load. Falling back to 'zh'.`);
                if (lang !== 'zh') { return await loadTranslations('zh'); } // Recurse for 'zh'
                translations = {}; // Reset if 'zh' also fails
                return {};
            }
            translations = await response.json();
            return translations;
        } catch (error) {
            console.error(`Error loading translations for ${lang}:`, error);
            if (lang !== 'zh') { return await loadTranslations('zh'); } // Recurse for 'zh' on error
            translations = {}; // Reset if 'zh' also fails on error
            return {};
        }
    }

    /**
     * Clears all cached sign data
     */
    function clearSignDataCache() {
        signDataStore = {};
    }

    /**
     * Loads sign data (data-xx.json) for the specified language.
     * Falls back to Chinese ('zh') data if the requested language data fails.
     * Caches loaded data and prevents multiple simultaneous loads.
     * @param {string} lang - Language code.
     * @returns {Promise<Array>} Array of sign data objects.
     */
    async function loadSignData(lang) {
        // If data is already cached for this language, return it immediately
        if (signDataStore[lang] && signDataStore[lang].length > 0) {
            return signDataStore[lang];
        }

        // If a load for this language is already in progress, return that promise
        if (isDataLoading && dataLoadPromise) {
            return dataLoadPromise;
        }

        isDataLoading = true;
        dataLoadPromise = (async () => {
            try {
                const dataFileName = (lang === 'zh') ? 'data.json' : `data-${lang.toLowerCase()}.json`;
                // Use a timestamp to prevent browser caching
                const response = await fetch(`${dataFileName}?t=${new Date().getTime()}`);
                
                if (!response.ok) {
                    console.warn(`Sign data for ${lang} (${dataFileName}) not found or failed. Falling back to Chinese.`);
                    if (lang === 'zh') throw new Error('CRITICAL: Failed to load Chinese sign data (data.json).');
                    
                    // Attempt to load 'zh' if not already cached
                    if (signDataStore['zh'] && signDataStore['zh'].length > 0) {
                        signDataStore[lang] = signDataStore['zh']; // Use cached 'zh'
                        return signDataStore['zh'];
                    } else {
                        const fallbackData = await loadSignData('zh'); // This will fetch 'zh'
                        signDataStore[lang] = fallbackData; // Cache for current lang
                        return fallbackData;
                    }
                }

                const data = await response.json();
                if (!data || data.length === 0) {
                    console.warn(`Sign data for ${lang} (${dataFileName}) is empty. Falling back to Chinese.`);
                    if (lang === 'zh') throw new Error('CRITICAL: Chinese sign data (data.json) is empty.');

                    if (signDataStore['zh'] && signDataStore['zh'].length > 0) {
                         signDataStore[lang] = signDataStore['zh'];
                         return signDataStore['zh'];
                    } else {
                        const fallbackData = await loadSignData('zh');
                        signDataStore[lang] = fallbackData;
                        return fallbackData;
                    }
                }
                signDataStore[lang] = data;
                return data;
            } catch (error) {
                console.error(`Failed to fetch sign data for ${lang}:`, error);
                // Fallback to Chinese if primary language fails and it's not Chinese itself
                if (lang !== 'zh') {
                    if (signDataStore['zh'] && signDataStore['zh'].length > 0) {
                        console.warn(`Returning cached Chinese data after error loading ${lang}.`);
                        signDataStore[lang] = signDataStore['zh'];
                        return signDataStore['zh'];
                    } else {
                        try {
                            const fallbackData = await loadSignData('zh');
                            signDataStore[lang] = fallbackData;
                            return fallbackData;
                        } catch (zhError) {
                            console.error("CRITICAL: Fallback to Chinese sign data also failed.", zhError);
                            return []; // Return empty array if everything fails
                        }
                    }
                }
                return []; // Return empty if 'zh' fails critically during its own load attempt
            } finally {
                isDataLoading = false;
                dataLoadPromise = null; // Clear promise only after this specific load finishes
            }
        })();
        return dataLoadPromise;
    }

    /**
     * Updates the text content of elements with data-lang-key attributes based on loaded translations.
     * Also handles language-specific UI changes (e.g., hiding buttons).
     */
    function translatePage() {
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            if (translations[key] !== undefined) {
                if (element.tagName === 'TITLE') { element.textContent = translations[key]; }
                else { element.innerHTML = translations[key]; } // Use innerHTML for keys like loadingText which contain <br>
            } else {
                // console.warn(`Translation key "${key}" not found for language "${currentLang}".`);
            }
        });
        document.documentElement.lang = currentLang; // Set HTML lang attribute

        // Language specific UI changes
        if (btnExample) {
            btnExample.style.display = (currentLang === 'en') ? 'none' : '';
        }

        // Update loading message if visible
        if (!loadingScreen.classList.contains('hidden')) {
            updateLockMessage();
        }
        // If a sign is currently displayed, re-render it with new translations
        // This is handled by setLanguage calling renderSign explicitly.
    }

    /**
     * Updates the visual state of language switcher buttons.
     */
    function updateActiveLangButton() {
        langSwitcherBtns.forEach(btn => {
            const btnLang = btn.getAttribute('data-lang');
            if (btnLang === currentLang) {
                btn.style.display = 'none';
            } else {
                btn.style.display = '';
            }
        });
    }

    /**
     * Updates the text content of the splash screen overlay with animation.
     */
    function updateSplashOverlayText(text, animate = true) {
        if (!splashTextOverlay) return;

        // Clear any existing animation timeouts and classes
        if (textOverlayTimeoutId) {
            clearTimeout(textOverlayTimeoutId);
            textOverlayTimeoutId = null;
        }
        splashTextOverlay.classList.remove('text-enter-active', 'text-exit-active');
        // Force reflow for class removal to take effect before adding new ones
        void splashTextOverlay.offsetWidth;

        const currentDisplayedText = splashTextOverlay.textContent;

        // Clear any existing snowflake characters from previous animation
        const existingSnowflakes = splashTextOverlay.querySelectorAll('.snowflake-char');
        if (existingSnowflakes.length > 0) {
            splashTextOverlay.innerHTML = ''; // Important to clear before setting new text or starting new animation
        }
        
        // Condition for animation: animate flag is true, text is different, and splash screen is visible
        if (animate && text !== currentDisplayedText && !splashScreen.classList.contains('hidden')) {
            // --- Shattering Snowflake Effect for Outgoing Text ---
            // Use the text that was on screen for the shattering effect
            const textToShatter = currentDisplayedText || ""; // If it was cleared, use empty string
            splashTextOverlay.innerHTML = ''; // Ensure it's clear before adding snowflakes

            const chars = textToShatter.split('');
            const fragment = document.createDocumentFragment();
            let hasVisibleCharsToAnimate = false;

            chars.forEach(char => {
                if (char.trim() === '') {
                    // Append spaces as text nodes or non-animated spans to maintain layout
                    const spaceSpan = document.createElement('span');
                    spaceSpan.innerHTML = char === ' ' ? '&nbsp;' : char; // Handle multiple spaces if needed
                    fragment.appendChild(spaceSpan);
                    return;
                }
                hasVisibleCharsToAnimate = true;
                const span = document.createElement('span');
                span.textContent = char;
                span.classList.add('snowflake-char');
                // Randomize animation properties
                span.style.setProperty('--random-x-end', (Math.random() * 200 - 100) + 'px');
                span.style.setProperty('--random-y-end', (Math.random() * 100 + 50) + 'px');
                span.style.setProperty('--random-rotate-end', (Math.random() * 720 - 360) + 'deg');
                span.style.setProperty('--random-duration', (Math.random() * 0.5 + 0.8) + 's');
                span.style.setProperty('--random-delay', (Math.random() * 0.3) + 's');
                fragment.appendChild(span);
            });
            splashTextOverlay.appendChild(fragment);
            
            const snowflakeAnimationDuration = hasVisibleCharsToAnimate ? 1600 : 0; // Max duration (1.3s) + max delay (0.3s)

            textOverlayTimeoutId = setTimeout(() => {
                splashTextOverlay.innerHTML = ''; // Clear snowflakes
                splashTextOverlay.textContent = text; // Set new text
                void splashTextOverlay.offsetWidth; // Force reflow
                splashTextOverlay.classList.add('text-enter-active'); // Add enter animation class for new text

                textOverlayTimeoutId = setTimeout(() => {
                    splashTextOverlay.classList.remove('text-enter-active');
                    textOverlayTimeoutId = null;
                }, 700); // Match enter animation duration (0.7s)

            }, snowflakeAnimationDuration);

        } else {
            // If no animation needed, just set the text
            splashTextOverlay.textContent = text;
            splashTextOverlay.classList.remove('text-enter-active', 'text-exit-active'); // Ensure no animation classes
        }
    }

    /**
     * Sets the application language, loads necessary resources, and updates the UI.
     * @param {string} lang - The target language code.
     */
    async function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem('preferredLang', lang);

        await loadTranslations(lang); // Load translations first
        
        // Update UI text and button states
        translatePage();
        updateActiveLangButton();

        // Update splash screen text overlay with animation
        const splashTextKey = 'appTitle';
        const splashText = translations[splashTextKey] || (currentLang === 'en' ? "Spiritual Lots' Mysteries" : "灵签玄机");
        updateSplashOverlayText(splashText, true); // Animate for language change

        // Reload sign data if a sign is currently shown
        if (currentSign && currentSign.签号) {
            const signNumberToKeep = currentSign.签号;
            try {
                const allSignDataForNewLang = await loadSignData(currentLang);
                if (allSignDataForNewLang && allSignDataForNewLang.length > 0) {
                    const newSignVersion = allSignDataForNewLang.find(s => s.签号 === signNumberToKeep);
                    if (newSignVersion) {
                        currentSign = newSignVersion;
                        // Render sign text first
                        renderSign(currentSign);
                        // Defer theme application to allow text to render
                        requestAnimationFrame(() => {
                           applyThemeBasedOnSign(currentSign);
                        });
                    } else {
                        console.warn(`Sign No. ${signNumberToKeep} not found in ${currentLang} data.`);
                    }
                } else {
                    console.warn(`No sign data loaded for language ${currentLang}. Cannot update sign.`);
                }
            } catch (error) {
                console.error(`Error reloading sign data for language ${lang}:`, error);
            }
        }
    }

    /**
     * Initializes the application's language settings on page load.
     */
    async function initializeLanguage() {
        const preferredLang = localStorage.getItem('preferredLang');
        const browserLang = navigator.language.split('-')[0].toLowerCase();
        let langToSet = preferredLang || ((browserLang === 'zh') ? 'zh' : 'en');

        await loadTranslations(langToSet); // Load translations for the determined language
        currentLang = langToSet; // Set currentLang *after* translations are loaded
        localStorage.setItem('preferredLang', langToSet);
        
        // Set initial splash text WITHOUT animation for speed
        const splashTextKey = 'appTitle';
        const initialSplashText = translations[splashTextKey] || (currentLang === 'en' ? "Spiritual Lots' Mysteries" : "灵签玄机");
        if (splashTextOverlay) {
            // Use the non-animated path of updateSplashOverlayText
            updateSplashOverlayText(initialSplashText, false);
        }
        
        // Apply other translations and button state
        translatePage();
        updateActiveLangButton();
    }

    // Add event listeners for language buttons
    langSwitcherBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const langToSet = e.target.getAttribute('data-lang');
            if (langToSet && langToSet !== currentLang) {
                setLanguage(langToSet);
            }
        });
    });

    /**
     * Preloads sign data for both Chinese and English
     * to speed up subsequent display
     */
    async function preloadSignData() {
        console.log('Preloading sign data files...');
        try {
            // Start loading both language data files in parallel
            const zhDataPromise = loadSignData('zh');
            const enDataPromise = loadSignData('en');
            
            // Wait for both to complete
            await Promise.all([zhDataPromise, enDataPromise]);
            console.log('Sign data preloading complete');
        } catch (error) {
            console.error('Error during sign data preloading:', error);
            // Continue execution even if preloading fails
        }
    }

    // Execute initialization
    await initializeLanguage(); // Initialize language first
    preloadSignData(); // Preload data files for faster access
    checkLockStatus(); // Then check lock status

    // --- Core Application Logic (Event Listeners, Functions) ---

    /** Updates the message displayed on the loading screen */
    function updateLockMessage() {
        const lockEndTime = localStorage.getItem('drawBtnLockUntil');
        const overlayTextEl = loadingScreen.querySelector('.overlay-text');
        if (!overlayTextEl) return;

        let message = '';
        if (lockEndTime && new Date().getTime() < parseInt(lockEndTime)) {
            const remainingTime = Math.ceil((parseInt(lockEndTime) - new Date().getTime()) / 60000);
            let messageKey, fallbackMessage;
            if (remainingTime >= 30) {
                messageKey = 'lockMessageFrequent';
                fallbackMessage = '初告之...半小时后再求他事';
            } else {
                messageKey = 'lockMessageRemaining';
                fallbackMessage = `请平心静气<br>${remainingTime}分钟后再来`;
            }
            message = (translations[messageKey] || fallbackMessage).replace('{minutes}', remainingTime);
        } else {
            message = translations.loadingText || '虔诚求问...轻触屏幕';
        }
        overlayTextEl.innerHTML = message; // innerHTML because message can contain <br>
    }

    /** Checks lock status and updates UI */
    function checkLockStatus() {
        const lockEndTime = localStorage.getItem('drawBtnLockUntil');
        if (lockEndTime && new Date().getTime() < parseInt(lockEndTime)) {
            // If splash screen is visible, hide it first
            if (!splashScreen.classList.contains('hidden')) {
                splashScreen.style.opacity = 0;
                setTimeout(() => splashScreen.classList.add('hidden'), 800); // Match CSS transition
            }
            // Show locked loading screen
            loadingScreen.classList.remove('hidden');
            loadingScreen.classList.add('locked');
            loadingScreen.style.opacity = 1; // Ensure it's visible
            updateLockMessage();
            return true; // Is locked
        } else if (loadingScreen.classList.contains('locked')) {
            // If it was locked but time expired, unlock it
            loadingScreen.classList.remove('locked');
            updateLockMessage(); // Update message to normal loading
        }
        return false; // Is not locked
    }

    // Sun Area Click Handler
    sunArea.addEventListener('click', () => {
        splashScreen.style.opacity = 0; // Start fade out of splash
        const burst = document.createElement('div'); burst.className = 'sun-burst'; sunArea.appendChild(burst);
        sunArea.classList.remove('sun-glow'); void sunArea.offsetWidth; sunArea.classList.add('sun-glow');
        const core = document.createElement('div'); core.className = 'sun-core'; sunArea.appendChild(core);

        setTimeout(() => {
            splashScreen.classList.add('hidden'); // Hide splash screen after fade
            loadingScreen.classList.remove('hidden'); // Prepare loading screen
            loadingScreen.style.opacity = 0; // Start loading screen as transparent
            
            burst.remove(); 
            core.remove();

            if (checkLockStatus()) { // Check lock status *before* fading in loading screen
                loadingScreen.style.opacity = 1; // If locked, show it immediately
                return;
            }
            
            updateLockMessage(); // Update to normal loading message
            // Short delay before fading in loading screen to ensure message is updated
            setTimeout(() => {
                loadingScreen.style.opacity = 1; // Fade in loading screen
            }, 50);
        }, 800); // Duration of splash screen fade
    });

    // Loading Screen Click Handler
    loadingScreen.addEventListener('click', () => {
        if (loadingScreen.classList.contains('locked')) return; // Do nothing if locked

        // Prepare main content (hidden by default, opacity 0)
        mainContent.classList.remove('hidden');
        mainContent.style.opacity = 0; 
        qianContent.style.opacity = 0; // Ensure qian content is also initially transparent

        loadingScreen.style.opacity = 0; // Fade out loading screen

        setTimeout(async () => { // Make this async
            loadingScreen.classList.add('hidden'); // Hide loading screen after fade
            
            mainContent.style.transition = 'opacity 1.2s ease-in';
            mainContent.style.opacity = 1; // Fade in main content shell

            // Fetch and render sign *before* trying to fade in qianContent
            // fetchRandomSign will set qianContent's innerHTML (e.g. to spinner)
            await fetchRandomSign(); 
            
            // After sign is fetched and rendered (or spinner is shown), then fade in qianContent
            // A small delay to ensure mainContent opacity transition starts
            setTimeout(() => {
                qianContent.style.transition = 'opacity 0.8s ease-in';
                qianContent.style.opacity = 1; // Fade in the actual sign content (or spinner)
            }, 100); // Adjust delay as needed, 500ms might be too long if spinner is used

        }, 1000); // Duration of loading screen fade
    });
    
    // Video Container Click Handler (if used for loading animation)
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.addEventListener('click', () => {
            // Trigger loading screen click only if not locked
            if (!loadingScreen.classList.contains('locked')) {
                loadingScreen.click();
            }
        });
    }

    /** Fetches and displays a random sign */
    async function fetchRandomSign() {
        try {
            // Show loading state in qianContent (if mainContent is already visible)
            qianContent.innerHTML = '<div class="loading-spinner"></div>';
            // Opacity for qianContent is handled by the loadingScreen click handler
            
            let data = await loadSignData(currentLang);
            
            if (!data || data.length === 0) {
                throw new Error(`Sign data for language ${currentLang} (and fallback 'zh') is empty or failed to load.`);
            }

            const randomIndex = Math.floor(Math.random() * data.length);
            currentSign = data[randomIndex];

            // Render sign text first
            renderSign(currentSign);
            
            // Apply theme in the next animation frame to allow text rendering to complete
            requestAnimationFrame(() => {
                 applyThemeBasedOnSign(currentSign);
            });

        } catch (error) {
            console.error('Error fetching sign data:', error);
            qianContent.innerHTML = `<p>${translations.fetchSignError || '获取签文失败，请重试'}</p>`;
            currentSign = null; // Reset current sign
            applyThemeBasedOnSign(null); // Reset theme to default
        }
    }

    /** Renders sign details */
    function renderSign(sign) {
        if (!sign) { 
            qianContent.innerHTML = ''; 
            return; 
        }

        const fragment = document.createDocumentFragment();
        const container = document.createElement('div');
        
        const ancientProphecyTitle = translations.ancientProphecyTitle || "远古预言";
        const overallFortuneTitle = translations.overallFortuneTitle || "整体运程";
        const signNumberPrefix = translations.signNumberPrefix === undefined ? "第 " : translations.signNumberPrefix;
        const signNumberSuffix = translations.signNumberSuffix === undefined ? " 签" : translations.signNumberSuffix;
        const noDataText = translations.noDataLabel || "(暂无数据)";

        container.innerHTML = `
            <div class="sign-header">
                <p class="sign-number">${signNumberPrefix}${sign.签号}${signNumberSuffix}</p>
                <p class="luck-index">${sign.幸运指数 || ''}</p>
            </div>
            <div class="ancient-prophecy">
                <h3>${ancientProphecyTitle}</h3>
                <p>${sign.远古预言 ? sign.远古预言.replace(/\n/g, '<br>') : noDataText}</p>
            </div>
            <div class="overall-fortune">
                <h3>${overallFortuneTitle}</h3>
                <p>${sign.整体运程 ? sign.整体运程.replace(/\n/g, '<br>') : noDataText}</p>
            </div>
            <div class="summary">
                <h3>${sign.总结 || noDataText}</h3>
            </div>
        `;

        fragment.appendChild(container);
        
        qianContent.innerHTML = ''; // Clear previous content or spinner
        qianContent.appendChild(fragment); // Append new sign content
    }

    /** Applies theme based on sign */
    function applyThemeBasedOnSign(sign) {
        // Remove all existing theme classes from body
        document.body.className = document.body.className.replace(/\btheme-[a-z-]+\b/g, '');
        
        // Clear existing effects from effectsContainer
        const effectsContainer = document.getElementById('effectsContainer');
        if (effectsContainer) {
            effectsContainer.innerHTML = ''; // Clear previous particles/rays
        }
        
        // Clear existing theme background elements
        const themeBg = document.querySelector('.theme-background');
        if (themeBg) {
            themeBg.innerHTML = ''; // Clear previous background elements
        }

        // Reset extra styles on buttons and result box to default
        applyExtraStyles(null); // Pass null for default styles

        if (!sign || typeof sign.幸运指数 !== 'string') {
            // console.warn("Invalid sign data for theme application. Applying default theme.");
            // Default theme is already applied by applyExtraStyles(null) and no body class
            return;
        }

        const luckLevel = sign.幸运指数.split('').filter(char => char === '★').length;
        
        let themeClass = '';
        let colorTheme = ''; // For addExtraElements
        let particleCount = 0;
        let styleKey = ''; // For applyExtraStyles

        switch (luckLevel) {
            case 5:
            case 6: // Assuming 6 stars is also very lucky
                themeClass = 'theme-very-lucky';
                colorTheme = 'gold';
                particleCount = 30;
                styleKey = 'very-lucky';
                break;
            case 4:
                themeClass = 'theme-lucky';
                colorTheme = 'silver';
                particleCount = 20;
                styleKey = 'lucky';
                break;
            case 3:
                themeClass = 'theme-neutral';
                colorTheme = 'green';
                particleCount = 15;
                styleKey = 'neutral';
                break;
            case 2:
                themeClass = 'theme-unlucky';
                colorTheme = 'red';
                particleCount = 10;
                styleKey = 'unlucky';
                break;
            default: // Covers 1 star or any other unexpected value
                themeClass = 'theme-very-unlucky';
                colorTheme = 'purple';
                particleCount = 5;
                styleKey = 'very-unlucky';
        }

        // Apply theme changes
        // requestAnimationFrame(() => { // Already called within requestAnimationFrame by caller
            document.body.classList.add(themeClass);
            addExtraElements(colorTheme, particleCount);
            applyExtraStyles(styleKey);
            createThematicBackground(luckLevel); // This creates elements
            applyAnimations(luckLevel); // This applies animations to elements created by createThematicBackground
        // });
    }

    /** Creates thematic background elements */
    function createThematicBackground(luckLevel) {
        let container = document.querySelector('.theme-background');
        if (!container) {
            container = document.createElement('div');
            container.className = 'theme-background';
            const effectsContainerRef = document.getElementById('effectsContainer'); // Use a different var name
            const insertBeforeElement = effectsContainerRef ? effectsContainerRef.nextSibling : document.body.firstChild;
            document.body.insertBefore(container, insertBeforeElement);
        }
        container.innerHTML = ''; // Clear existing content

        const elementsCount = Math.max(0, luckLevel * 5); // Consistent with original logic
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < elementsCount; i++) {
            const element = document.createElement('div');
            element.className = 'theme-bg-element'; // Base class
            
            Object.assign(element.style, {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: `${10 + Math.random() * 40}px`,
                height: `${10 + Math.random() * 40}px`,
                transform: `rotate(${Math.random() * 360}deg)`
            });
            fragment.appendChild(element);
        }
        container.appendChild(fragment);
    }

    /** Applies animations to background elements */
    function applyAnimations(luckLevel) {
        const elements = document.querySelectorAll('.theme-bg-element'); // Should target elements created by createThematicBackground
        if (elements.length === 0) return;

        const animationClass = luckLevel >= 5 ? 'anim-float-gold' :
                             luckLevel === 4 ? 'anim-float-silver' :
                             luckLevel === 3 ? 'anim-float' :
                             luckLevel === 2 ? 'anim-flicker' :
                             'anim-fade';

        const batchSize = 10; // Process in batches for performance
        for (let i = 0; i < elements.length; i += batchSize) {
            const batch = Array.from(elements).slice(i, i + batchSize);
            requestAnimationFrame(() => { // Defer each batch to next frame
                batch.forEach((el, index) => {
                    el.style.animationDelay = `${(i + index) * 0.1}s`; // Stagger animation start
                    el.classList.add(animationClass); // Add specific animation class
                });
            });
        }
    }

    // Draw Button Click Handler
    drawBtn.addEventListener('click', () => {
        if (globalAudio && !globalAudio.paused) { globalAudio.pause(); globalAudio.currentTime = 0; globalAudio = null; }

        const lockEndTime = localStorage.getItem('drawBtnLockUntil');
        if (lockEndTime && new Date().getTime() < parseInt(lockEndTime)) {
            mainContent.style.transition = 'opacity 0.8s ease'; mainContent.style.opacity = 0;
            setTimeout(() => {
                mainContent.classList.add('hidden');
                loadingScreen.classList.remove('hidden');
                loadingScreen.style.opacity = 0; // Start transparent
                loadingScreen.classList.add('locked');
                updateLockMessage();
                setTimeout(() => loadingScreen.style.opacity = 1, 50); // Fade in
            }, 800);
            return;
        }

        const clicksData = JSON.parse(localStorage.getItem('drawBtnClicks') || '[]');
        const now = new Date().getTime();
        // Filter out clicks older than 4 minutes
        const recentClicks = clicksData.filter(timestamp => now - timestamp <= 4 * 60 * 1000);
        recentClicks.push(now); // Add current click
        localStorage.setItem('drawBtnClicks', JSON.stringify(recentClicks));

        if (recentClicks.length > 3) { // If more than 3 clicks in the last 4 minutes
            const lockUntil = now + 30 * 60 * 1000; // Lock for 30 minutes
            localStorage.setItem('drawBtnLockUntil', lockUntil.toString());
            mainContent.style.transition = 'opacity 0.8s ease'; mainContent.style.opacity = 0;
            setTimeout(() => {
                mainContent.classList.add('hidden');
                loadingScreen.classList.remove('hidden');
                loadingScreen.style.opacity = 0;
                loadingScreen.classList.add('locked');
                updateLockMessage();
                setTimeout(() => loadingScreen.style.opacity = 1, 50);
            }, 800);
            return;
        }

        // Normal redraw process
        mainContent.style.transition = 'opacity 0.8s ease';
        mainContent.style.opacity = 0;
        setTimeout(() => {
            mainContent.classList.add('hidden');
            loadingScreen.classList.remove('hidden');
            loadingScreen.classList.remove('locked'); // Ensure not locked
            loadingScreen.style.opacity = 0;
            updateLockMessage(); // Set to normal loading message
            
            setTimeout(() => loadingScreen.style.opacity = 1, 50);

            currentSign = null;
            qianContent.innerHTML = ''; // Clear sign content
            applyThemeBasedOnSign(null); // Reset theme

            // Reset sun area elements if they exist
            const oldSunElements = document.querySelectorAll('.sun-burst, .sun-core');
            oldSunElements.forEach(el => el.remove());
            if (sunArea) sunArea.classList.remove('sun-glow');

        }, 800); // After main content fades out
    });

    // Touch feedback for draw button
    drawBtn.addEventListener('touchstart', () => drawBtn.style.transform = 'scale(0.95)');
    drawBtn.addEventListener('touchend', () => drawBtn.style.transform = 'scale(1)');

    // Action Buttons Click Handler
    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!currentSign) {
                showAlert(translations.alertPleaseDrawFirst || '请先获取灵签');
                return;
            }
            const action = btn.getAttribute('data-action');
            switch(action) {
                case 'fortune': showFortuneModal(); break;
                case 'tips': showTipsModal(); break;
                case 'mantra': showMantraModal(); break;
                case 'example': 
                    if (currentLang !== 'en' && btnExample && btnExample.style.display !== 'none') {
                        showExampleModal();
                    }
                    break;
            }
        });
    });

    // --- Share Button Logic ---

    function showInputModal() {
        return new Promise((resolve) => {
            const modalId = 'request-input-modal';
            let existingModal = document.getElementById(modalId);
            if (existingModal) existingModal.remove();

            const modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal input-modal';
            modal.innerHTML = `
                <div class="modal-content input-modal-content">
                    <div class="modal-header input-modal-header">
                        <h3 class="modal-title input-modal-title">${translations.enterRequestPrompt || '请输入所求之事'}</h3>
                        <span class="close-modal input-close-modal">&times;</span>
                    </div>
                    <div class="modal-body input-modal-body">
                        <textarea id="request-input-area" class="request-textarea" rows="4" placeholder="${translations.enterRequestPlaceholder || (translations.enterRequestPrompt || '请输入所求之事')}..."></textarea>
                        <div class="modal-buttons input-modal-buttons">
                            <button id="confirm-request" class="modal-btn confirm-btn input-confirm-btn">${translations.confirmButton || '确认'}</button>
                            <button id="cancel-request" class="modal-btn cancel-btn input-cancel-btn">${translations.cancelButton || '取消'}</button>
                        </div>
                    </div>
                </div>`;
            
            document.body.appendChild(modal);

            const textarea = modal.querySelector('#request-input-area');
            const confirmBtn = modal.querySelector('#confirm-request');
            const cancelBtn = modal.querySelector('#cancel-request');
            const closeBtn = modal.querySelector('.input-close-modal');

            const styleId = 'input-modal-dynamic-styles';
            let styleElement = document.getElementById(styleId);
            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = styleId;
                document.head.appendChild(styleElement);
            }
            
            styleElement.textContent = `
                .input-modal .input-modal-content {
                    background: #2c2a3a; 
                    border: 1px solid #5a5278; 
                    border-radius: 12px;
                    box-shadow: 0 5px 25px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,215,0,0.2) inset;
                    color: #e0d8f0;
                    max-width: 520px; 
                    width: 90%; 
                }
                .input-modal .input-modal-header {
                    border-bottom: 1px solid #4a4660;
                    padding: 15px 20px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                }
                .input-modal .input-modal-title {
                    color: var(--gold);
                    font-size: 1.3em; 
                    text-shadow: 0 0 5px rgba(255,215,0,0.5);
                    margin: 0; 
                    flex-grow: 1; 
                    text-align: left; 
                    padding-right: 10px; 
                }
                .input-modal .input-close-modal {
                    color: var(--gold);
                    opacity: 0.7;
                    transition: opacity 0.2s;
                    font-size: 1.8rem; 
                    padding: 0; 
                    line-height: 1; 
                    flex-shrink: 0; 
                }
                .input-modal .input-close-modal:hover {
                    opacity: 1;
                }
                .input-modal .input-modal-body {
                    padding: 25px 30px; 
                }
                .request-textarea {
                    width: 100%;
                    padding: 12px; 
                    margin-bottom: 25px; 
                    border: 1px solid #5a5278; 
                    border-radius: 8px; 
                    font-size: 16px; 
                    background: rgba(20, 18, 30, 0.8); 
                    color: #e8e0f8; 
                    resize: vertical; 
                    min-height: 80px; 
                    box-sizing: border-box;
                    font-family: inherit;
                    line-height: 1.5; 
                }
                .request-textarea::placeholder {
                    color: #9c95b0; 
                }
                .request-textarea:focus {
                    outline: none;
                    border-color: var(--gold);
                    box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); 
                }
                .input-modal-buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 15px; 
                }
                .input-modal .modal-btn { 
                    padding: 12px 25px; 
                    border-radius: 25px; 
                    font-size: 1em;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s ease-out;
                    border: 1px solid transparent;
                }
                .input-modal .input-confirm-btn {
                    background: var(--gold);
                    color: #2c2a3a; 
                    border-color: var(--gold);
                }
                .input-modal .input-confirm-btn:hover {
                    background: #e6c300; 
                    box-shadow: 0 2px 10px rgba(255,215,0,0.4);
                }
                .input-modal .input-cancel-btn {
                    background: transparent;
                    color: #c0b8d0; 
                    border: 1px solid #6a6288; 
                }
                .input-modal .input-cancel-btn:hover {
                    background: rgba(255,255,255,0.08);
                    color: #f0e8ff;
                    border-color: #8a839e;
                }
            `;

            setTimeout(() => textarea.focus(), 100);

            const closeModalFunction = () => { 
                modal.remove();
            };

            confirmBtn.addEventListener('click', () => {
                const value = textarea.value.trim();
                closeModalFunction();
                resolve(value);
            });

            cancelBtn.addEventListener('click', () => {
                closeModalFunction();
                resolve(null);
            });

            closeBtn.addEventListener('click', () => {
                closeModalFunction();
                resolve(null);
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModalFunction();
                    resolve(null);
                }
            });
             textarea.addEventListener('keyup', (e) => {
                if (e.key === 'Escape') {
                    closeModalFunction();
                    resolve(null);
                }
            });
        });
    }

    shareBtn.addEventListener('click', async () => {
        if (!currentSign) {
            showAlert(translations.alertPleaseDrawFirst || '请先获取灵签');
            return;
        }

        const userRequest = await showInputModal();
        if (userRequest === null) return; 
        
        currentUserRequest = userRequest;

        const originalShareText = shareBtn.querySelector('[data-lang-key]').textContent;
        shareBtn.querySelector('[data-lang-key]').textContent = translations.generatingImage || "生成中...";
        shareBtn.disabled = true;

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const canvasWidth = 500;
            const sidePadding = 35; 
            const contentWidth = canvasWidth - (sidePadding * 2);
            
            const baseFontFamily = `KaiTi, STKaiti, "华文楷体", SimSun, "儷宋 Pro", "LiSong Pro", serif`;
            const engBaseFontFamily = `Georgia, "Times New Roman", Times, serif`;
            
            const titleFontSize = 30;       
            const requestFontSize = 24;     
            const dateFontSize = 16;        
            const luckIndexFontSize = 22;   // Increased Luck Index font size
            const sectionTitleFontSize = 23;
            const bodyFontSize = 19;        
            const summaryFontSize = 26;     
            const qrSize = 80;             

            const requestLineHeight = requestFontSize * 1.4;
            const luckIndexLineHeight = luckIndexFontSize * 1.35; // Adjusted
            const bodyLineHeight = bodyFontSize * 1.5; 
            const summaryLineHeight = summaryFontSize * 1.4;

            const topPadding = 40;
            const spaceAfterTitle = 20;
            const spaceAfterRequest = 20;
            const spaceAfterDate = 18;      
            const spaceAfterLuckIndex = 30; 
            const spaceAfterSectionTitle = 15;
            const spaceBetweenSections = 28;
            const spaceBeforeSummary = 30;
            const spaceAfterSummary = 30;
            const spaceBeforeQR = 25; 
            const bottomPadding = 40;

            let currentY = topPadding;

            // --- Calculate total height needed ---
            ctx.font = `bold ${titleFontSize}px ${baseFontFamily}`;
            currentY += titleFontSize + spaceAfterTitle;

            ctx.font = `bold ${requestFontSize}px ${baseFontFamily}`;
            const requestLines = wrapText(ctx, currentUserRequest, contentWidth);
            currentY += requestLines.length * requestLineHeight + spaceAfterRequest;
            
            ctx.font = `${dateFontSize}px ${engBaseFontFamily}`; 
            currentY += dateFontSize + spaceAfterDate;

            ctx.font = `bold ${luckIndexFontSize}px Arial, sans-serif`;
            currentY += luckIndexLineHeight + spaceAfterLuckIndex;

            ctx.font = `bold ${sectionTitleFontSize}px ${baseFontFamily}`;
            currentY += sectionTitleFontSize + spaceAfterSectionTitle;
            ctx.font = `${bodyFontSize}px ${currentLang === 'en' ? engBaseFontFamily : baseFontFamily}`;
            const prophecyText = currentSign.远古预言 || (translations.noDataLabel || "(No Data)");
            const prophecyLinesWrapped = prophecyText.split('\n').reduce((acc, val) => acc.concat(wrapText(ctx, val, contentWidth)), []);
            currentY += prophecyLinesWrapped.length * bodyLineHeight + spaceBetweenSections;

            ctx.font = `bold ${sectionTitleFontSize}px ${baseFontFamily}`;
            currentY += sectionTitleFontSize + spaceAfterSectionTitle;
            ctx.font = `${bodyFontSize}px ${currentLang === 'en' ? engBaseFontFamily : baseFontFamily}`;
            const fortuneText = currentSign.整体运程 || (translations.noDataLabel || "(No Data)");
            const fortuneLinesWrapped = fortuneText.split('\n').reduce((acc, val) => acc.concat(wrapText(ctx, val, contentWidth)), []);
            currentY += fortuneLinesWrapped.length * bodyLineHeight + spaceBeforeSummary;

            ctx.font = `bold ${summaryFontSize}px ${baseFontFamily}`;
            const summaryText = currentSign.总结 || (translations.noDataLabel || "(No Data)");
            const summaryLinesWrapped = wrapText(ctx, summaryText, contentWidth);
            currentY += summaryLinesWrapped.length * summaryLineHeight + spaceAfterSummary;
            
            currentY += spaceBeforeQR + qrSize + bottomPadding; 
            
            const calculatedCanvasHeight = Math.max(currentY, 900); 

            canvas.width = canvasWidth;
            canvas.height = calculatedCanvasHeight;
            // --- End Height Calculation ---


            // --- Drawing with Bright & Mystical Theme ---
            ctx.fillStyle = '#FFFDF7'; // Very light, almost white with a hint of cream/yellow
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Decorative border - Using a double line
            ctx.strokeStyle = '#D0BBA0'; // Softer, desaturated gold
            ctx.lineWidth = 7; 
            ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, canvas.width - ctx.lineWidth, canvas.height - ctx.lineWidth);
            ctx.strokeStyle = '#F0E6D2'; // Very light inner line for highlight effect
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);


            currentY = topPadding;
            
            // App Title
            ctx.textAlign = 'center';
            ctx.fillStyle = '#5D4037'; // Darker, rich brown
            ctx.font = `bold ${titleFontSize}px "${currentLang === 'en' ? 'Times New Roman' : 'STKaiti'}", ${baseFontFamily}`; 
            ctx.shadowColor = "rgba(0,0,0,0.1)";
            ctx.shadowBlur = 2;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(translations.appTitle || '灵签玄机', canvas.width / 2, currentY + titleFontSize * 0.75); 
            ctx.shadowColor = "transparent"; 
            currentY += titleFontSize + spaceAfterTitle;
            
            // User Request
            ctx.font = `bold ${requestFontSize}px "${currentLang === 'en' ? 'Times New Roman' : 'STKaiti'}", ${baseFontFamily}`; 
            ctx.fillStyle = '#795548'; 
            requestLines.forEach(line => {
                ctx.fillText(line, canvas.width / 2, currentY + requestFontSize * 0.75);
                currentY += requestLineHeight;
            });
            if (requestLines.length > 0) currentY -= requestLineHeight;
            currentY += requestLineHeight + spaceAfterRequest;

            // Date
            ctx.font = `italic ${dateFontSize}px ${engBaseFontFamily}`; 
            ctx.fillStyle = '#9E8A7A'; 
            const displayDate = new Date().toLocaleDateString((currentLang === 'zh' ? 'zh-CN' : 'en-US'), { year: 'numeric', month: 'long', day: 'numeric' });
            ctx.fillText(displayDate, canvas.width / 2, currentY + dateFontSize * 0.75);
            currentY += dateFontSize + spaceAfterDate;

            // Luck Index (Stars)
            const luckIndexText = currentSign.幸运指数 || "";
            ctx.font = `bold ${luckIndexFontSize}px Arial, sans-serif`; 
            ctx.fillStyle = '#FFC107'; // Bright Gold color for stars
            ctx.shadowColor = "rgba(180, 120, 0, 0.4)"; // Gold shadow
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
            ctx.fillText(luckIndexText, canvas.width / 2, currentY + luckIndexFontSize * 0.75);
            ctx.shadowColor = "transparent"; // Reset shadow
            currentY += luckIndexLineHeight + spaceAfterLuckIndex;
            
            // Content Sections
            ctx.textAlign = 'left';
            const sectionTextColor = '#5D4037'; 
            const sectionTitleColor = '#4E342E'; 

            function drawDecorativeLine(yPos) { // More subtle line
                ctx.strokeStyle = '#E0D6C0'; // Light beige line
                ctx.lineWidth = 0.75;
                const lineY = yPos - spaceAfterSectionTitle / 2 + 3; // Adjusted position
                ctx.beginPath();
                ctx.moveTo(sidePadding, lineY);
                ctx.lineTo(canvasWidth - sidePadding, lineY);
                ctx.stroke();
            }
            
            // Ancient Prophecy
            drawDecorativeLine(currentY);
            ctx.font = `bold ${sectionTitleFontSize}px "${currentLang === 'en' ? 'Times New Roman' : 'STKaiti'}", ${baseFontFamily}`; 
            ctx.fillStyle = sectionTitleColor;
            ctx.fillText(translations.ancientProphecyTitle || "Ancient Prophecy", sidePadding, currentY + sectionTitleFontSize * 0.75); 
            currentY += sectionTitleFontSize + spaceAfterSectionTitle;
            
            ctx.font = `${bodyFontSize}px ${currentLang === 'en' ? engBaseFontFamily : baseFontFamily}`; 
            ctx.fillStyle = sectionTextColor;
            prophecyLinesWrapped.forEach(line => {
                ctx.fillText(line, sidePadding, currentY + bodyFontSize * 0.75); 
                currentY += bodyLineHeight;
            });
            if (prophecyLinesWrapped.length > 0) currentY -= bodyLineHeight; 
            currentY += bodyLineHeight + spaceBetweenSections;

            // Overall Fortune
            drawDecorativeLine(currentY);
            ctx.font = `bold ${sectionTitleFontSize}px "${currentLang === 'en' ? 'Times New Roman' : 'STKaiti'}", ${baseFontFamily}`; 
            ctx.fillStyle = sectionTitleColor;
            ctx.fillText(translations.overallFortuneTitle || "Overall Fortune", sidePadding, currentY + sectionTitleFontSize * 0.75); 
            currentY += sectionTitleFontSize + spaceAfterSectionTitle;
            
            ctx.font = `${bodyFontSize}px ${currentLang === 'en' ? engBaseFontFamily : baseFontFamily}`; 
            ctx.fillStyle = sectionTextColor;
            fortuneLinesWrapped.forEach(line => {
                ctx.fillText(line, sidePadding, currentY + bodyFontSize * 0.75); 
                currentY += bodyLineHeight;
            });
            if (fortuneLinesWrapped.length > 0) currentY -= bodyLineHeight; 
            currentY += bodyLineHeight + spaceBeforeSummary;
            
            // Summary
            drawDecorativeLine(currentY);
            ctx.textAlign = 'center';
            ctx.font = `bold ${summaryFontSize}px "${currentLang === 'en' ? 'Times New Roman' : 'STKaiti'}", ${baseFontFamily}`; 
            ctx.fillStyle = '#6D4C41'; 
            summaryLinesWrapped.forEach(line => {
                ctx.fillText(line, canvas.width / 2, currentY + summaryFontSize * 0.75);
                currentY += summaryLineHeight;
            });
            if (summaryLinesWrapped.length > 0) currentY -= summaryLineHeight;
            currentY += summaryLineHeight + spaceAfterSummary;

            // QR Code (Centered, no text below)
            const qrCanvasElement = document.createElement('canvas'); 
            new QRious({
                element: qrCanvasElement,
                value: 'https://fish-gao.github.io',
                size: qrSize,
                level: 'H', 
                background: 'rgba(255,255,255,0.9)', // Slightly transparent white
                foreground: '#402E2F' 
            });
            
            const qrXPos = (canvasWidth - qrSize) / 2; 
            const qrActualYPosition = canvas.height - bottomPadding - qrSize;
            ctx.drawImage(qrCanvasElement, qrXPos, qrActualYPosition, qrSize, qrSize);
            
            // --- End Drawing ---

            const imageDataUrl = canvas.toDataURL('image/png');
            previewImageElement.src = imageDataUrl;
            imagePreviewModal.classList.remove('hidden');
            imagePreviewModal.style.opacity = 1;

            const instructionArea = imagePreviewModal.querySelector('.preview-instruction-area'); 
            if (instructionArea) {
                instructionArea.innerHTML = `<p class="long-press-instruction">${translations.longPressToSaveInstruction || '长按图片保存到手机相册'}</p>`;
            }
            
        } catch (error) {
            console.error('Error generating share image:', error);
            showAlert(translations.generateShareImageError || '生成分享图片失败，请重试');
        } finally {
            shareBtn.querySelector('[data-lang-key]').textContent = originalShareText;
            shareBtn.disabled = false;
        }
    });

    function wrapText(ctx, text, maxWidth) {
        const lines = [];
        if (!text) return lines;
        const paragraphs = text.split('\n'); 

        paragraphs.forEach(paragraph => {
            let currentLine = "";
            const chars = paragraph.split(''); 
            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                const testLine = currentLine + char;
                if (ctx.measureText(testLine).width > maxWidth && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }
        });
        return lines;
    }


    closePreviewModalBtn.addEventListener('click', () => {
        imagePreviewModal.style.opacity = 0;
        setTimeout(() => imagePreviewModal.classList.add('hidden'), 300); 
    });
    
    imagePreviewModal.addEventListener('click', (e) => {
        if (e.target === imagePreviewModal) {
            imagePreviewModal.style.opacity = 0;
            setTimeout(() => imagePreviewModal.classList.add('hidden'), 300);
        }
    });

    // --- Modal Functions ---

    /** Displays a custom alert message */
    function showAlert(message, duration = 2500) {
        const alertBoxId = 'custom-alert-box';
        let alertBox = document.getElementById(alertBoxId);
        if (alertBox) { 
            alertBox.remove();
        }
        alertBox = document.createElement('div');
        alertBox.id = alertBoxId;
        alertBox.className = 'alert'; 
        alertBox.innerHTML = message; 
        document.body.appendChild(alertBox);
        
        void alertBox.offsetWidth; 
        alertBox.style.opacity = '1';

        setTimeout(() => {
            alertBox.style.opacity = '0';
            setTimeout(() => {
                if (alertBox && alertBox.parentElement) {
                    alertBox.remove();
                }
            }, 300); 
        }, duration - 300);
    }

    /** Shows the luck categories modal */
    function showFortuneModal() {
        if (!currentSign || !currentSign.分类运程) return;
        const modalTitle = translations.categoryFortuneButton || "分类运程";
        const categoryKeysInOrder = ["健康", "财运", "感情", "考学", "事业", "人际", "纠纷", "远行"];
        const categoryMap = { 
            "健康": translations.healthTitle || "健康",
            "财运": translations.wealthLuckTitle || "财运",
            "感情": translations.loveLifeTitle || "感情",
            "考学": translations.examsTitle || "考学",
            "事业": translations.careerTitle || "事业",
            "人际": translations.interpersonalRelationshipsTitle || "人际",
            "纠纷": translations.disputesTitle || "纠纷",
            "远行": translations.longJourneysTitle || "远行"
        };
        const noDataText = translations.noDataLabel || "(暂无数据)";
        let fortuneItems = '';
        for (const key of categoryKeysInOrder) {
            if (currentSign.分类运程.hasOwnProperty(key)) {
                const text = currentSign.分类运程[key];
                fortuneItems += `<div class="category-item"><h4>${categoryMap[key] || key}</h4><p>${text ? text.replace(/\n/g, '<br>') : noDataText}</p></div>`;
            }
        }
        showModal(modalTitle, `<div class="category-fortunes">${fortuneItems}</div>`);
    }

    /** Shows the tips modal */
    function showTipsModal() {
        if (!currentSign) return;
        const modalTitle = translations.outfitAdviceButton || "开运锦囊";
        const outfitSubTitle = translations.outfitAdviceSubTitle || "穿搭建议";
        const pouchSubTitle = translations.luckyCharmPouchSubTitle || "开运锦囊";
        const noDataText = translations.noDataLabel || "(暂无数据)";
        
        const outfitAdvice = currentSign.穿搭建议 ? currentSign.穿搭建议.replace(/\n/g, '<br>') : noDataText;
        const luckyCharmPouch = currentSign.开运锦囊 ? currentSign.开运锦囊.replace(/\n/g, '<br>') : noDataText;

        showModal(modalTitle, `
            <div class="modal-section lucky-tips-section">
                <div class="tips-container">
                    <h4>${outfitSubTitle}</h4>
                    <p>${outfitAdvice}</p>
                </div>
                <div class="tips-container">
                    <h4>${pouchSubTitle}</h4>
                    <p>${luckyCharmPouch}</p>
                </div>
            </div>`);
    }

    /** Shows the mantra modal with audio controls */
    function showMantraModal() {
        if (!currentSign) return;
        const modalTitleText = translations.mantraBlessingButton || "佛咒加持";
        const playText = translations.playButton || "播放";
        const shuffleText = translations.shuffleButton || "随机";
        const stopText = translations.stopButton || "停止";
        const shareText = translations.shareMantraText || "分享好友...";
        const sanskritTextLabel = translations.sanskritLabel || "梵文：";
        const meaningTextLabel = translations.meaningLabel || "咒语含义：";
        const noDataText = translations.noDataLabel || "（暂无数据）";

        const currentFileTitle = currentSign.文件标题 ? currentSign.文件标题 : noDataText;
        const currentSanskrit = currentSign.梵文 || noDataText;
        const currentMeaning = currentSign.咒语含义 || noDataText;

        const modalHTML = `
            <div class="modal-section mantra-section">
                <h4 class="mantra-title">${currentFileTitle}</h4>
                <p class="mantra-sanskrit">${sanskritTextLabel}${currentSanskrit}</p>
                <p class="mantra-meaning">${meaningTextLabel}${currentMeaning}</p>
                <div class="mantra-controls">
                    <button id="play-mantra" class="mantra-btn">
                        <span class="icon">🔊</span> <span class="btn-text">${playText}</span>
                    </button>
                    <button id="random-mantra" class="mantra-btn random-btn">
                        <span class="icon">🔄</span> <span class="btn-text">${shuffleText}</span>
                    </button>
                </div>
                <div class="share-link-container">
                    <p class="share-text">${shareText}</p>
                </div>
            </div>`;
        showModal(modalTitleText, modalHTML);

        let isRandomAudioPlaying = false; 
        const playBtn = document.getElementById('play-mantra');
        const randomBtn = document.getElementById('random-mantra');
        const playBtnIcon = playBtn.querySelector('.icon');
        const playBtnTextSpan = playBtn.querySelector('.btn-text');
        const randomBtnIcon = randomBtn.querySelector('.icon');
        const randomBtnTextSpan = randomBtn.querySelector('.btn-text');
        
        let modalAudio = null; 

        function stopModalAudio() {
            if (modalAudio && !modalAudio.paused) {
                modalAudio.pause();
                modalAudio.currentTime = 0;
            }
            if (globalAudio === modalAudio) globalAudio = null; 
            modalAudio = null;

            playBtnIcon.textContent = '🔊'; playBtnTextSpan.textContent = playText;
            randomBtnIcon.textContent = '🔄'; randomBtnTextSpan.textContent = shuffleText;
            isRandomAudioPlaying = false;
        }

        function playAudioFileInModal(fileNameToPlay, isRandom = false, title, sanskrit, meaning) {
            stopModalAudio(); 

            if (!fileNameToPlay || fileNameToPlay === noDataText) {
                showAlert(translations.audioLoadError || '音频文件丢失');
                return;
            }
            
            document.querySelector('.mantra-title').textContent = title;
            document.querySelector('.mantra-sanskrit').textContent = `${sanskritTextLabel}${sanskrit}`;
            document.querySelector('.mantra-meaning').textContent = `${meaningTextLabel}${meaning}`;

            modalAudio = new Audio(`music/${fileNameToPlay}`);
            modalAudio.loop = true;
            isRandomAudioPlaying = isRandom; 

            modalAudio.play().then(() => {
                if (isRandom) {
                    randomBtnIcon.textContent = '⏹'; randomBtnTextSpan.textContent = stopText;
                    playBtnIcon.textContent = '🔊'; playBtnTextSpan.textContent = playText; 
                } else {
                    playBtnIcon.textContent = '⏹'; playBtnTextSpan.textContent = stopText;
                    randomBtnIcon.textContent = '🔄'; randomBtnTextSpan.textContent = shuffleText; 
                }
                globalAudio = modalAudio; 
            }).catch(error => {
                console.error('Audio playback failed:', error);
                showAlert(translations.audioLoadError || '音频加载失败');
                stopModalAudio(); 
            });
        }

        playBtn.addEventListener('click', () => {
            if (modalAudio && !modalAudio.paused && !isRandomAudioPlaying) {
                stopModalAudio();
            } else {
                playAudioFileInModal(currentSign.文件名, false, currentFileTitle, currentSanskrit, currentMeaning);
            }
        });

        randomBtn.addEventListener('click', async () => {
            if (modalAudio && !modalAudio.paused && isRandomAudioPlaying) {
                stopModalAudio();
            } else {
                try {
                    let allSignData = await loadSignData(currentLang);
                    if (!allSignData || allSignData.length === 0) {
                        allSignData = await loadSignData('zh'); 
                    }
                    if (!allSignData || allSignData.length === 0) {
                        showAlert(translations.fetchRandomDataError || '获取随机数据失败');
                        return;
                    }
                    const randomIndex = Math.floor(Math.random() * allSignData.length);
                    const randomSignData = allSignData[randomIndex];

                    if (!randomSignData || !randomSignData.文件名) {
                        showAlert(translations.fetchRandomDataError || '获取随机数据失败');
                        return;
                    }
                    
                    const rFileTitle = randomSignData.文件标题 ? randomSignData.文件标题 : noDataText;
                    const rSanskrit = randomSignData.梵文 || noDataText;
                    const rMeaning = randomSignData.咒语含义 || noDataText;
                    
                    playAudioFileInModal(randomSignData.文件名, true, rFileTitle, rSanskrit, rMeaning);

                } catch (error) {
                    console.error('Failed to get random sign data:', error);
                    showAlert(translations.fetchRandomDataError || '获取随机数据失败');
                }
            }
        });
    }


    /** Shows the interpretation example modal */
    function showExampleModal() {
        if (!currentSign || !currentSign.解读举例) return;
        const modalTitle = translations.interpretationExampleButton || "解读举例";
        const noDataText = translations.noDataLabel || "(暂无数据)";
        const exampleText = currentSign.解读举例 ? currentSign.解读举例.replace(/\n/g, '<br>') : noDataText;
        showModal(modalTitle, `<div class="modal-section"><p>${exampleText}</p></div>`);
    }

    /** Creates and displays a generic modal */
    function showModal(title, content) {
        if (globalAudio && !globalAudio.paused) {
            globalAudio.pause();
            globalAudio.currentTime = 0;
            globalAudio = null; 
        }

        const existingModal = document.querySelector('.modal:not(#image-preview-modal):not(#request-input-modal)');
        if (existingModal) {
            existingModal.remove(); 
        }

        const modal = document.createElement('div');
        modal.className = 'modal'; 
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>`;
        document.body.appendChild(modal);
        styleModal(modal); 

        const closeModalBtn = modal.querySelector('.close-modal');
        const modalCloseHandler = () => {
            const playBtnInThisModal = modal.querySelector('#play-mantra'); 
            if (playBtnInThisModal && globalAudio && !globalAudio.paused) { 
                 globalAudio.pause();
                 globalAudio.currentTime = 0;
                 globalAudio = null;
            }
            modal.remove();
        };

        closeModalBtn.addEventListener('click', modalCloseHandler);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modalCloseHandler();
            }
        });
    }

    /** Applies theme-based styling to the modal */
    function styleModal(modal) {
        const modalContent = modal.querySelector('.modal-content');
        
        if (modal.classList.contains('input-modal') || modal.id === 'image-preview-modal') {
            return;
        }

        const modalHeader = modal.querySelector('.modal-header');
        const modalTitle = modal.querySelector('.modal-title');
        const bodyClasses = document.body.classList;

        let borderColor = 'var(--gold)', 
            shadowColor = 'rgba(255, 215, 0, 0.5)', 
            titleColor = 'var(--gold)', 
            headerBorderColor = 'rgba(255, 215, 0, 0.3)';

        if (bodyClasses.contains('theme-very-lucky')) {
            borderColor = '#FFD700'; shadowColor = 'rgba(255, 215, 0, 0.5)'; titleColor = '#FFD700'; headerBorderColor = 'rgba(255, 215, 0, 0.3)';
        } else if (bodyClasses.contains('theme-lucky')) {
            borderColor = '#C0C0C0'; shadowColor = 'rgba(192, 192, 192, 0.5)'; titleColor = '#C0C0C0'; headerBorderColor = 'rgba(192, 192, 192, 0.3)';
        } else if (bodyClasses.contains('theme-neutral')) {
            borderColor = '#ADFF2F'; shadowColor = 'rgba(173, 255, 47, 0.5)'; titleColor = '#ADFF2F'; headerBorderColor = 'rgba(173, 255, 47, 0.3)';
        } else if (bodyClasses.contains('theme-unlucky')) {
            borderColor = '#DC143C'; shadowColor = 'rgba(220, 20, 60, 0.5)'; titleColor = '#DC143C'; headerBorderColor = 'rgba(220, 20, 60, 0.3)';
        } else if (bodyClasses.contains('theme-very-unlucky')) {
            borderColor = '#6A5ACD'; shadowColor = 'rgba(106, 90, 205, 0.5)'; titleColor = '#6A5ACD'; headerBorderColor = 'rgba(106, 90, 205, 0.3)';
        }
        
        if (modalContent) modalContent.style.borderColor = borderColor;
        if (modalContent) modalContent.style.boxShadow = `0 0 30px ${shadowColor}`;
        if (modalTitle) modalTitle.style.color = titleColor;
        if (modalHeader) modalHeader.style.borderBottomColor = headerBorderColor;
    }

    // --- Theme Effect Functions ---

    /** Adds extra visual elements based on the theme */
    function addExtraElements(colorTheme, count) {
        const effectsContainer = document.getElementById('effectsContainer');
        if (!effectsContainer) return;
        effectsContainer.innerHTML = ''; 

        const fragment = document.createDocumentFragment(); 

        for (let i = 0; i < count; i++) {
            const element = document.createElement('div');
            element.className = `extra-theme-element ${colorTheme}-element`;
            element.style.left = `${Math.random() * 100}%`;
            element.style.top = `${Math.random() * 100}%`;
            const size = 5 + Math.random() * 15;
            element.style.width = `${size}px`;
            element.style.height = `${size}px`;
            element.style.animationDelay = `${Math.random() * 5}s`;
            fragment.appendChild(element);
        }

        for (let i = 0; i < Math.floor(count / 2); i++) {
            const sparkle = document.createElement('div');
            sparkle.className = `mystic-sparkle ${colorTheme}-sparkle`;
            sparkle.style.left = `${Math.random() * 100}%`;
            sparkle.style.top = `${Math.random() * 100}%`;
            const sparkleSize = `${2 + Math.random() * 6}px`;
            sparkle.style.width = sparkleSize;
            sparkle.style.height = sparkleSize;
            sparkle.style.animationDelay = `${Math.random() * 3}s`;
            sparkle.style.animationDuration = `${1 + Math.random() * 4}s`;
            fragment.appendChild(sparkle);
        }

        if (colorTheme === 'gold' || colorTheme === 'silver') {
            for (let i = 0; i < 8; i++) { 
                const ray = document.createElement('div');
                ray.className = `mystic-ray ${colorTheme}-ray`;
                ray.style.transform = `rotate(${i * 45}deg)`;
                ray.style.animationDelay = `${i * 0.2}s`;
                fragment.appendChild(ray);
            }
        }
        effectsContainer.appendChild(fragment); 
    }

    /** Applies theme-specific styles to buttons and result box */
    function applyExtraStyles(theme) {
        resultBox.className = 'result-box'; 
        if (theme) {
            resultBox.classList.add(`box-${theme}`); 
        }

        const themeStyles = {
            'very-lucky': { gradient: 'linear-gradient(45deg, #FFD700, #FFA500)', shadow: '0 0 20px rgba(255, 215, 0, 0.7)', color: '#FFD700' },
            'lucky': { gradient: 'linear-gradient(45deg, #C0C0C0, #A9A9A9)', shadow: '0 0 20px rgba(192, 192, 192, 0.7)', color: '#C0C0C0' },
            'neutral': { gradient: 'linear-gradient(45deg, #ADFF2F, #7CFC00)', shadow: '0 0 20px rgba(173, 255, 47, 0.7)', color: '#ADFF2F' },
            'unlucky': { gradient: 'linear-gradient(45deg, #DC143C, #B22222)', shadow: '0 0 20px rgba(220, 20, 60, 0.7)', color: '#DC143C' },
            'very-unlucky': { gradient: 'linear-gradient(45deg, #6A5ACD, #483D8B)', shadow: '0 0 20px rgba(106, 90, 205, 0.7)', color: '#6A5ACD' }
        };
        
        const styles = theme && themeStyles[theme] ? themeStyles[theme] : { 
            gradient: 'linear-gradient(45deg, var(--draw-button-bg-start, #d4af37), var(--draw-button-bg-end, #c9a227))', 
            shadow: '0 5px 15px var(--draw-button-shadow, rgba(212, 175, 55, 0.4))',     
            color: 'var(--gold)'                               
        };
        
        drawBtn.style.background = styles.gradient; 
        drawBtn.style.boxShadow = styles.shadow;

        const shareBgStart = getComputedStyle(document.documentElement).getPropertyValue('--share-button-bg-start').trim() || '#5c4a9c';
        const shareBgEnd = getComputedStyle(document.documentElement).getPropertyValue('--share-button-bg-end').trim() || '#423574';
        const shareShadow = getComputedStyle(document.documentElement).getPropertyValue('--share-button-shadow').trim() || 'rgba(70, 58, 122, 0.45)';
        
        if (theme && themeStyles[theme] && themeStyles[theme].shareGradient) { 
            shareBtn.style.background = themeStyles[theme].shareGradient;
            shareBtn.style.boxShadow = themeStyles[theme].shareShadow || styles.shadow; 
        } else { 
            shareBtn.style.background = `linear-gradient(45deg, ${shareBgStart}, ${shareBgEnd})`;
            shareBtn.style.boxShadow = `0 5px 15px ${shareShadow}`;
        }


        actionBtns.forEach(btn => {
            btn.style.borderColor = styles.color;
            btn.style.color = styles.color;
            
            let btnShadowColorHex = styles.color;
            if (theme) { 
                if (btnShadowColorHex.startsWith('#')) { 
                    let r = parseInt(btnShadowColorHex.slice(1, 3), 16);
                    let g = parseInt(btnShadowColorHex.slice(3, 5), 16);
                    let b = parseInt(btnShadowColorHex.slice(5, 7), 16);
                    btn.style.boxShadow = `0 0 10px rgba(${r},${g},${b},0.5)`;
                } else { 
                    btn.style.boxShadow = `0 0 10px rgba(255,215,0,0.3)`; 
                }
            } else { 
                btn.style.borderColor = 'var(--gold)';
                btn.style.color = 'var(--gold)';
                btn.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.3)'; 
            }
        });
    }

}); // End of DOMContentLoaded
