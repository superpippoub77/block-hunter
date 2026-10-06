export function inferPurposeFromName(name) {
    const n = String(name || '').toLowerCase();
    if (n.startsWith('load') || n.startsWith('queue') || n.startsWith('preload')) return 'Carica o prepara risorse.';
    if (n.startsWith('create') || n.startsWith('build') || n.startsWith('spawn')) return 'Crea elementi di scena o stato runtime.';
    if (n.startsWith('update') || n.startsWith('render') || n.startsWith('draw')) return 'Aggiorna stato o rendering durante il frame.';
    if (n.startsWith('handle') || n.startsWith('on') || n.startsWith('input')) return 'Gestisce eventi o input utente.';
    if (n.startsWith('reset') || n.startsWith('clear')) return 'Resetta dati runtime o stato di gioco.';
    if (n.startsWith('save')) return 'Salva dati persistenti o progressi.';
    if (n.startsWith('parse') || n.startsWith('resolve') || n.startsWith('get')) return 'Legge/trasforma dati e restituisce un valore.';
    if (n.startsWith('is') || n.startsWith('has') || n.startsWith('can') || n.startsWith('should')) return 'Esegue un controllo logico.';
    return 'Metodo di supporto del flusso di gioco.';
}

export function getFunctionParamNames(fn) {
    try {
        const src = String(fn || '');
        const regularMatch = src.match(/^[\s\w]*\(([^)]*)\)/);
        const arrowMatch = src.match(/^\s*([^=()]+?)\s*=>/);
        const raw = regularMatch ? regularMatch[1] : (arrowMatch ? arrowMatch[1] : '');
        if (!raw) return [];
        return raw
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => p.replace(/=.*$/g, '').replace(/^\.\.\./, '').trim())
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

export function inferOutputFromName(name, fn) {
    const n = String(name || '').toLowerCase();
    const isAsync = fn && fn.constructor && fn.constructor.name === 'AsyncFunction';
    if (isAsync) return 'Promise<misto>';
    if (n.startsWith('is') || n.startsWith('has') || n.startsWith('can') || n.startsWith('should')) return 'boolean';
    if (n.startsWith('get') || n.startsWith('parse') || n.startsWith('resolve') || n.startsWith('format')) return 'misto';
    return 'void/misto';
}

export function toDocEntry(owner, methodName, fn, purposeOverride) {
    const params = getFunctionParamNames(fn).map((p) => ({ name: p, type: 'misto', description: `Parametro ${p}` }));
    return {
        owner,
        name: methodName,
        purpose: purposeOverride || inferPurposeFromName(methodName),
        input: params,
        output: inferOutputFromName(methodName, fn)
    };
}

export function buildTopLevelFunctionDocs(toDocEntryFn, functionsByName) {
    const ordered = [
        ['queueLegacyPreloadAssets', 'Carica il pacchetto asset base usato dal preload legacy.'],
        ['queueAssetsFromManifest', 'Carica asset dal manifest data/data.json e restituisce il conteggio enqueue.'],
        ['mergeLocalConfig', 'Applica override della configurazione salvata in locale.'],
        ['loadTranslations', 'Carica il dizionario lingua e invoca callback con i dati.'],
        ['clearRuntimeMatchStorage', 'Pulisce storage runtime/sessione per evitare leak tra partite.'],
        ['resetGameStateForNewRun', 'Reinizializza lo stato partita per 1P/2P.'],
        ['drawTextPanel', 'Disegna pannello grafico dietro un testo HUD.'],
        ['getTextureMaxNumericFrame', 'Trova il frame numerico massimo disponibile in una texture.'],
        ['playLoopAudioSafely', 'Avvia audio loop in sicurezza evitando eccezioni hard.'],
        ['resolveContactSpec', 'Normalizza la spec di contatto da tipo stringa a oggetto.'],
        ['getLevelFileName', 'Calcola il nome file JSON del livello richiesto.'],
        ['getLevelMasterNumber', 'Converte indice livello in numero master da usare nei percorsi.'],
        ['parseExitTargetLevel', 'Interpreta target livello dall\'uscita.'],
        ['addSpikeCredit', 'Aggiunge firma/credit in overlay di scena.'],
        ['inizialization', 'Bootstrap del gioco: carica config, top score e avvia Phaser.']
    ];

    return ordered
        .filter(([name]) => typeof functionsByName[name] === 'function')
        .map(([name, purpose]) => toDocEntryFn('global', name, functionsByName[name], purpose));
}

export function buildSceneMethodsDocs(sceneClasses, toDocEntryFn) {
    const docs = [];
    (sceneClasses || []).forEach((SceneClass) => {
        if (!SceneClass || !SceneClass.prototype) return;
        const owner = SceneClass.name || 'UnknownScene';
        const methods = Object.getOwnPropertyNames(SceneClass.prototype)
            .filter((name) => name !== 'constructor')
            .filter((name) => typeof SceneClass.prototype[name] === 'function')
            .sort((a, b) => a.localeCompare(b));

        methods.forEach((name) => {
            docs.push(toDocEntryFn(owner, name, SceneClass.prototype[name]));
        });
    });
    return docs;
}

export function chooseTraceLevel(methodName) {
    const n = String(methodName || '').toLowerCase();
    if (n === 'preload' || n === 'create' || n === 'update' || n === 'save' || n.startsWith('start')) return 'info';
    if (n.startsWith('set') || n.startsWith('load') || n.startsWith('reset') || n.startsWith('handle')) return 'debug';
    return 'trace';
}

export function instrumentSceneMethods(sceneClasses, logger, chooseTraceLevelFn) {
    (sceneClasses || []).forEach((SceneClass) => {
        if (!SceneClass || !SceneClass.prototype) return;

        const methodNames = Object.getOwnPropertyNames(SceneClass.prototype)
            .filter((name) => name !== 'constructor')
            .filter((name) => typeof SceneClass.prototype[name] === 'function');

        methodNames.forEach((methodName) => {
            const original = SceneClass.prototype[methodName];
            if (!original || original.__bhTraced === true) return;

            const level = chooseTraceLevelFn(methodName);
            const scope = `${SceneClass.name}.${methodName}`;

            const wrapped = function tracedSceneMethod(...args) {
                try {
                    logger[level](scope, 'ENTER', `args=${args.length}`);
                    const result = original.apply(this, args);

                    if (result && typeof result.then === 'function') {
                        return result
                            .then((value) => {
                                logger.trace(scope, 'EXIT async');
                                return value;
                            })
                            .catch((err) => {
                                logger.error(scope, 'ERROR async', err);
                                throw err;
                            });
                    }

                    logger.trace(scope, 'EXIT');
                    return result;
                } catch (err) {
                    logger.error(scope, 'ERROR sync', err);
                    throw err;
                }
            };

            wrapped.__bhTraced = true;
            SceneClass.prototype[methodName] = wrapped;
        });
    });
}
