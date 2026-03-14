const DEFAULT_CONFIG_CACHE_KEY = 'creditsManagerOptions';

const DEFAULT_CONFIG = {
	positions: {
		coin: { x: 400, y: 520 },
		player1: { x: 150, y: 550 },
		player2: { x: 650, y: 550 }
	},
	styles: {
		coin: { fontSize: '24px', fill: '#ffee00ff' },
		player: { fontSize: '18px', fill: '#666666' }
	},
	sounds: {
		coin: { key: 'credits_manager_coin', src: 'module/creditsManager/music/coin.mp3', volume: 0.45 }
	},
	controls: {
		coinInsertKeys: ['5', '6'],
		startPlayer1Keys: ['1'],
		startPlayer2Keys: ['2'],
		freePlay: { enabled: false }
	},
	labels: {
		insertCoin: 'INSERT COIN',
		credit: 'CREDIT',
		freePlay: 'FREE PLAY',
		player1Ready: '1P',
		player2Ready: '2P'
	}
};

function readCreditsConfigFromScene(scene, opts = {}) {
	const keyFromOpts = String(opts.configCacheKey || '').trim();
	const key = keyFromOpts || DEFAULT_CONFIG_CACHE_KEY;
	try {
		const cfg = scene?.cache?.json?.get?.(key);
		if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
			return cfg;
		}
	} catch (e) { }
	return {};
}

function readText(value, fallback) {
	const t = String(value ?? '').trim();
	return t || fallback;
}

function normalizeControlKeyToken(raw) {
	let token = String(raw ?? '').trim().toUpperCase();
	if (!token) return '';
	if (token.startsWith('KEYDOWN-')) token = token.slice(8);
	const namedDigits = {
		ZERO: '0',
		ONE: '1',
		TWO: '2',
		THREE: '3',
		FOUR: '4',
		FIVE: '5',
		SIX: '6',
		SEVEN: '7',
		EIGHT: '8',
		NINE: '9'
	};
	if (namedDigits[token]) return namedDigits[token];
	const keyboardDigit = token.match(/^(DIGIT|NUMPAD)([0-9])$/);
	if (keyboardDigit) return keyboardDigit[2];
	return token;
}

// Credits manager: creates credit UI and exposes insertCoin()/helpers.
// Self-contained: reads defaults/options from module/creditsManager/json/config.json cache entry.
export function createCreditsManager(scene, opts = {}) {
	const GAME_STATE = opts.gameState || {};
	const hudDepth = (typeof opts.hudDepth === 'number') ? opts.hudDepth : 10000;
	const font = opts.font || '"Press Start 2P"';
	const fileCfg = readCreditsConfigFromScene(scene, opts);

	const cfgPos = (fileCfg.positions && typeof fileCfg.positions === 'object') ? fileCfg.positions : {};
	const cfgStyles = (fileCfg.styles && typeof fileCfg.styles === 'object') ? fileCfg.styles : {};
	const cfgSounds = (fileCfg.sounds && typeof fileCfg.sounds === 'object') ? fileCfg.sounds : {};
	const cfgControls = (fileCfg.controls && typeof fileCfg.controls === 'object') ? fileCfg.controls : {};
	const cfgLabels = (fileCfg.labels && typeof fileCfg.labels === 'object') ? fileCfg.labels : {};
	const gameConfig = (opts.config && typeof opts.config === 'object' && !Array.isArray(opts.config)) ? opts.config : {};
	const creditSettingsFromConfig = (gameConfig.creditSettings && typeof gameConfig.creditSettings === 'object' && !Array.isArray(gameConfig.creditSettings))
		? gameConfig.creditSettings
		: {};

	const maxPlayers = Math.max(
		1,
		Math.floor(
			Number.isFinite(Number(opts.maxPlayers))
				? Number(opts.maxPlayers)
				: (Number.isFinite(Number(creditSettingsFromConfig.maxPlayers)) ? Number(creditSettingsFromConfig.maxPlayers) : 2)
		)
	);
	const requiredCreditsSource = (opts.requiredCreditsByPlayers && typeof opts.requiredCreditsByPlayers === 'object' && !Array.isArray(opts.requiredCreditsByPlayers))
		? opts.requiredCreditsByPlayers
		: ((creditSettingsFromConfig.requiredCreditsByPlayers && typeof creditSettingsFromConfig.requiredCreditsByPlayers === 'object' && !Array.isArray(creditSettingsFromConfig.requiredCreditsByPlayers))
			? creditSettingsFromConfig.requiredCreditsByPlayers
			: {});
	const requiredCreditsByPlayers = {};
	for (let p = 1; p <= maxPlayers; p += 1) {
		const rawValue = requiredCreditsSource[String(p)] ?? requiredCreditsSource[p];
		const parsedValue = Number(rawValue);
		requiredCreditsByPlayers[p] = Number.isFinite(parsedValue) ? Math.max(0, Math.floor(parsedValue)) : p;
	}

	const coinPos = {
		x: (typeof opts.coinX === 'number')
			? opts.coinX
			: ((typeof opts.x === 'number') ? opts.x : (Number(cfgPos?.coin?.x) || DEFAULT_CONFIG.positions.coin.x)),
		y: (typeof opts.coinY === 'number') ? opts.coinY : (Number(cfgPos?.coin?.y) || DEFAULT_CONFIG.positions.coin.y)
	};
	const p1Pos = {
		x: (typeof opts.player1X === 'number') ? opts.player1X : (Number(cfgPos?.player1?.x) || DEFAULT_CONFIG.positions.player1.x),
		y: (typeof opts.player1Y === 'number') ? opts.player1Y : (Number(cfgPos?.player1?.y) || DEFAULT_CONFIG.positions.player1.y)
	};
	const p2Pos = {
		x: (typeof opts.player2X === 'number') ? opts.player2X : (Number(cfgPos?.player2?.x) || DEFAULT_CONFIG.positions.player2.x),
		y: (typeof opts.player2Y === 'number') ? opts.player2Y : (Number(cfgPos?.player2?.y) || DEFAULT_CONFIG.positions.player2.y)
	};

	const coinStyle = {
		fontSize: readText(opts.coinFontSize, readText(cfgStyles?.coin?.fontSize, DEFAULT_CONFIG.styles.coin.fontSize)),
		fill: readText(opts.coinFill, readText(cfgStyles?.coin?.fill, DEFAULT_CONFIG.styles.coin.fill)),
		fontFamily: font
	};
	const playerStyle = {
		fontSize: readText(opts.playerFontSize, readText(cfgStyles?.player?.fontSize, DEFAULT_CONFIG.styles.player.fontSize)),
		fill: readText(opts.playerFill, readText(cfgStyles?.player?.fill, DEFAULT_CONFIG.styles.player.fill)),
		fontFamily: font
	};

	const coinSound = {
		key: readText(opts.coinSoundKey, readText(cfgSounds?.coin?.key, DEFAULT_CONFIG.sounds.coin.key)),
		src: readText(opts.coinSoundSrc, readText(cfgSounds?.coin?.src, DEFAULT_CONFIG.sounds.coin.src)),
		volume: Number.isFinite(Number(opts.coinSoundVolume))
			? Number(opts.coinSoundVolume)
			: (Number.isFinite(Number(cfgSounds?.coin?.volume)) ? Number(cfgSounds.coin.volume) : DEFAULT_CONFIG.sounds.coin.volume)
	};
	const configuredCoinInsertKeys = Array.isArray(opts.coinInsertKeys)
		? opts.coinInsertKeys
		: (Array.isArray(cfgControls?.coinInsertKeys) ? cfgControls.coinInsertKeys : DEFAULT_CONFIG.controls.coinInsertKeys);
	const configuredStartPlayer1Keys = Array.isArray(opts.startPlayer1Keys)
		? opts.startPlayer1Keys
		: (Array.isArray(cfgControls?.startPlayer1Keys) ? cfgControls.startPlayer1Keys : DEFAULT_CONFIG.controls.startPlayer1Keys);
	const configuredStartPlayer2Keys = Array.isArray(opts.startPlayer2Keys)
		? opts.startPlayer2Keys
		: (Array.isArray(cfgControls?.startPlayer2Keys) ? cfgControls.startPlayer2Keys : DEFAULT_CONFIG.controls.startPlayer2Keys);
	const coinInsertKeys = configuredCoinInsertKeys
		.map((entry) => normalizeControlKeyToken(entry))
		.filter((entry) => entry.length > 0);
	const startPlayer1Keys = configuredStartPlayer1Keys
		.map((entry) => normalizeControlKeyToken(entry))
		.filter((entry) => entry.length > 0);
	const startPlayer2Keys = configuredStartPlayer2Keys
		.map((entry) => normalizeControlKeyToken(entry))
		.filter((entry) => entry.length > 0);
	const freePlayEnabled = (typeof opts.freePlayEnabled === 'boolean')
		? opts.freePlayEnabled
		: ((typeof creditSettingsFromConfig.freeplay === 'boolean') ? creditSettingsFromConfig.freeplay : !!cfgControls?.freePlay?.enabled);
	let coinSoundLoading = false;

	const normalizeRequestedPlayers = (players) => {
		const parsed = Math.floor(Number(players));
		if (!Number.isFinite(parsed) || parsed <= 1) return 1;
		return parsed;
	};

	const getRequiredCreditsForPlayers = (players) => {
		const requestedPlayers = normalizeRequestedPlayers(players);
		const configured = requiredCreditsByPlayers[requestedPlayers];
		if (Number.isFinite(Number(configured))) return Math.max(0, Math.floor(Number(configured)));
		return requestedPlayers;
	};

	const isFreePlayModeActive = () => {
		const externalFreePlay = (typeof opts.isFreePlayMode === 'function') ? !!opts.isFreePlayMode() : false;
		return externalFreePlay || freePlayEnabled;
	};

	const canPlayCoinSoundNow = () => {
		const key = String(coinSound.key || '').trim();
		return !!(key && scene?.cache?.audio?.exists && scene.cache.audio.exists(key));
	};

	const ensureCoinSoundLoaded = () => {
		const key = String(coinSound.key || '').trim();
		const src = String(coinSound.src || '').trim();
		if (!key || !src || !scene || !scene.load) return false;
		if (canPlayCoinSoundNow()) return true;
		if (coinSoundLoading) return false;

		try {
			coinSoundLoading = true;
			scene.load.audio(key, src);
			scene.load.once(`filecomplete-audio-${key}`, () => {
				coinSoundLoading = false;
			});
			scene.load.once('loaderror', () => {
				coinSoundLoading = false;
			});
			if (!scene.load.isLoading()) {
				scene.load.start();
			}
		} catch (e) {
			coinSoundLoading = false;
		}

		return false;
	};

	const playCoinSound = (volumeOverride) => {
		try {
			const key = String(coinSound.key || '').trim();
			if (!key || !scene || !scene.sound) return false;

			const volume = Number.isFinite(Number(volumeOverride)) ? Number(volumeOverride) : coinSound.volume;
			if (canPlayCoinSoundNow()) {
				scene.sound.play(key, { volume });
				return true;
			}

			ensureCoinSoundLoaded();
			try {
				scene.load.once(`filecomplete-audio-${key}`, () => {
					try {
						scene.sound.play(key, { volume });
					} catch (e) { }
				});
			} catch (e) { }
		} catch (e) { }
		return false;
	};

	const labels = {
		insertCoin: readText(cfgLabels.insertCoin, DEFAULT_CONFIG.labels.insertCoin),
		credit: readText(cfgLabels.credit, DEFAULT_CONFIG.labels.credit),
		freePlay: readText(cfgLabels.freePlay, DEFAULT_CONFIG.labels.freePlay),
		player1Ready: readText(cfgLabels.player1Ready, DEFAULT_CONFIG.labels.player1Ready),
		player2Ready: readText(cfgLabels.player2Ready, DEFAULT_CONFIG.labels.player2Ready)
	};

	try {
		scene.coinText = scene.add.text(coinPos.x, coinPos.y, '', coinStyle)
			.setOrigin(0.5)
			.setDepth(hudDepth)
			.setScrollFactor(0);
	} catch (e) { scene.coinText = null; }
	scene.coinPanel = null;

	try {
		scene.player1Text = scene.add.text(p1Pos.x, p1Pos.y, '', playerStyle)
			.setOrigin(0.5)
			.setDepth(hudDepth)
			.setScrollFactor(0);
	} catch (e) { scene.player1Text = null; }
	scene.player1Panel = null;

	try {
		scene.player2Text = scene.add.text(p2Pos.x, p2Pos.y, '', playerStyle)
			.setOrigin(0.5)
			.setDepth(hudDepth)
			.setScrollFactor(0);
	} catch (e) { scene.player2Text = null; }
	scene.player2Panel = null;

	const resolveTranslation = () => {
		if (typeof opts.getTranslation === 'function') {
			try {
				const t = opts.getTranslation();
				if (t && typeof t === 'object' && !Array.isArray(t)) return t;
			} catch (e) { }
		}

		try {
			if (typeof window !== 'undefined' && window.TRANSLATIONS && GAME_STATE.language) {
				const t = window.TRANSLATIONS[GAME_STATE.language];
				if (t && typeof t === 'object' && !Array.isArray(t)) return t;
			}
		} catch (e) { }

		return null;
	};

	const updateTexts = () => {
		try {
			const t = resolveTranslation();
			const credits = Number(GAME_STATE.credits) || 0;
			const freePlayMode = isFreePlayModeActive();
			const insertCoin = (t && t.insert_coin) ? t.insert_coin : labels.insertCoin;
			const credit = (t && t.credit) ? t.credit : labels.credit;
			const freePlay = (t && t.free_play) ? t.free_play : labels.freePlay;

			if (scene.coinText) {
				if (freePlayMode) scene.coinText.setText(freePlay);
				else if (credits <= 0) scene.coinText.setText(insertCoin);
				else scene.coinText.setText(`${credit} ${credits}`);
			}
			// Keep labels always visible: color state is handled by SharedFrontendScene.
			if (scene.player1Text) scene.player1Text.setText(labels.player1Ready);
			if (scene.player2Text) scene.player2Text.setText(labels.player2Ready);
		} catch (e) { }
	};

	const insertCoin = ({ volume = coinSound.volume, onChange } = {}) => {
		try {
			playCoinSound(volume);
		} catch (e) { }
		try {
			GAME_STATE.credits = (Number(GAME_STATE.credits) || 0) + 1;
			updateTexts();
			if (typeof onChange === 'function') {
				try { onChange(GAME_STATE.credits); } catch (e) { }
			}
			if (scene && typeof scene.updateUI === 'function') {
				try { scene.updateUI(); } catch (e) { }
			}
			if (scene && typeof scene.resetTimeout === 'function') {
				try { scene.resetTimeout(); } catch (e) { }
			}
		} catch (e) { }
	};

	const setCredits = (n) => {
		try {
			GAME_STATE.credits = Number(n) || 0;
			updateTexts();
		} catch (e) { }
	};

	const canActivatePlayers = (players) => {
		const requestedPlayers = normalizeRequestedPlayers(players);
		if (isFreePlayModeActive()) {
			// In freeplay, front-end start keys (1/2) must always be playable.
			return requestedPlayers >= 1 && requestedPlayers <= 2;
		}
		if (requestedPlayers > maxPlayers) return false;
		const credits = Number(GAME_STATE.credits) || 0;
		const requiredCredits = getRequiredCreditsForPlayers(requestedPlayers);
		return credits >= requiredCredits;
	};

	const activatePlayers = (players, callbacks = {}) => {
		const requestedPlayers = normalizeRequestedPlayers(players);
		if (!canActivatePlayers(requestedPlayers)) {
			if (typeof callbacks.onInsufficientCredits === 'function') {
				try { callbacks.onInsufficientCredits(requestedPlayers); } catch (e) { }
			}
			return false;
		}

		if (!isFreePlayModeActive()) {
			const credits = Number(GAME_STATE.credits) || 0;
			const requiredCredits = getRequiredCreditsForPlayers(requestedPlayers);
			GAME_STATE.credits = Math.max(0, credits - requiredCredits);
		}

		updateTexts();
		if (typeof callbacks.onBeforeStart === 'function') {
			try { callbacks.onBeforeStart(requestedPlayers); } catch (e) { }
		}
		if (typeof callbacks.onStart === 'function') {
			try { callbacks.onStart(requestedPlayers); } catch (e) { }
		}
		if (scene && typeof scene.updateUI === 'function') {
			try { scene.updateUI(); } catch (e) { }
		}
		return true;
	};

	const resolveControlAction = (event) => {
		const keyToken = normalizeControlKeyToken(event?.key || event?.code || '');
		const codeToken = normalizeControlKeyToken(event?.code || '');
		const matches = (tokens) => tokens.includes(keyToken) || tokens.includes(codeToken);

		if (matches(coinInsertKeys)) return { type: 'coin' };
		if (matches(startPlayer2Keys)) return { type: 'start', players: 2 };
		if (matches(startPlayer1Keys)) return { type: 'start', players: 1 };
		return null;
	};

	const handleControlInput = (event, handlers = {}) => {
		const action = resolveControlAction(event);
		if (!action) return { consumed: false };

		if (action.type === 'coin') {
			if (!isFreePlayModeActive()) {
				insertCoin({
					volume: Number.isFinite(Number(handlers.coinVolume)) ? Number(handlers.coinVolume) : coinSound.volume,
					onChange: handlers.onCoinInserted
				});
			}
			if (typeof handlers.onInteraction === 'function') {
				try { handlers.onInteraction('coin', action); } catch (e) { }
			}
			return { consumed: true, action };
		}

		if (action.type === 'start') {
			const started = activatePlayers(action.players, {
				onBeforeStart: handlers.onBeforeStart,
				onStart: handlers.onStart,
				onInsufficientCredits: handlers.onInsufficientCredits
			});
			if (typeof handlers.onInteraction === 'function') {
				try { handlers.onInteraction('start', action); } catch (e) { }
			}
			return { consumed: true, started, action };
		}

		return { consumed: false };
	};

	const getHandledControlKeys = () => {
		const out = new Set();
		for (const key of coinInsertKeys) out.add(key);
		for (const key of startPlayer1Keys) out.add(key);
		for (const key of startPlayer2Keys) out.add(key);
		return Array.from(out);
	};

	// Initialize texts immediately to avoid one-frame empty UI.
	updateTexts();
	// Queue module-local coin sound early to reduce first-coin latency.
	ensureCoinSoundLoaded();

	return {
		insertCoin,
		setCredits,
		updateTexts,
		getConfig: () => ({
			positions: { coin: coinPos, player1: p1Pos, player2: p2Pos },
			styles: { coin: coinStyle, player: playerStyle },
			sounds: { coin: coinSound },
			controls: { coinInsertKeys, startPlayer1Keys, startPlayer2Keys, freePlay: { enabled: freePlayEnabled } },
			labels,
			creditSettings: {
				maxPlayers,
				requiredCreditsByPlayers: { ...requiredCreditsByPlayers }
			}
		}),
		ensureCoinSoundLoaded,
		playCoinSound,
		isFreePlayMode: isFreePlayModeActive,
		activatePlayers,
		handleControlInput,
		getHandledControlKeys,
		canActivatePlayers
	};
}
