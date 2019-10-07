(function () {
    let lastPeerId = null;
    let peer = null; // own peer object
    let peerId = null;
    let conn = null;

    const statusDiv = document.getElementById('receive__status');
    const acceptDeclineContainer = document.getElementById('receive__accept-decline-container');
    const acceptButton = document.getElementById('receive__accept');
    const declineButton = document.getElementById('receive__decline');
    const fieldContainer = document.getElementById('receive__field-container');
    const field = document.getElementById('receive__field');
    const myIdDiv = document.getElementById('receive__my-id');
    const countdownDiv = document.getElementById('receive__countdown');
    const countdownValue = document.getElementById('receive__countdown-value');
    const scoreContainerDiv = document.getElementById('receive__score-common-container');
    const scoreDiv = document.getElementById('receive__score');
    const scoreByGamesDiv = document.getElementById('receive__score-by-games');

    let countdownInterval;

    const fieldConfig = {
        width: 720,
        height: 720,
        itemWidth: 60,
        itemHeight: 60,
        rows: 12,
        cols: 12,
        numOfItems: 7,
        numOfBombs: 3
    };
    let score = {
        me: 0,
        opponent: 0
    };
    let scoreByGames = {
        me: 0,
        opponent: 0
    };
    let levelConfig;
    let numOfItems = fieldConfig.numOfItems;
    let numOfBombs = fieldConfig.numOfBombs;

    acceptButton.addEventListener('click', acceptGame);
    declineButton.addEventListener('click', declineGame);

    function scale () {
        let width = document.documentElement.clientWidth;
        let k = width / fieldConfig.width;
        if (k < 1) {
            fieldContainer.style.transform = `scale(${k})`;
        }
    }
    window.addEventListener('resize', scale);

    function onGameInvitation () {
        // show accept and decline buttons
        acceptDeclineContainer.style.display = 'block';
        statusDiv.innerHTML = conn.peer + ' are inviting you';
    }

    function acceptGame () {
        conn.send({type: 'askForGame', payload: {accepted: true}});
        acceptDeclineContainer.style.display = 'none';
        scoreContainerDiv.style.display = 'flex';
        statusDiv.innerHTML = 'Game with: ' + conn.peer;
        startCountdown();
    }

    function declineGame () {
        conn.send({type: 'askForGame', payload: {accepted: false}});
        acceptDeclineContainer.style.display = 'none';
        statusDiv.innerHTML = 'You have declained invitation of ', conn.peer;
    }

    function restartGame () {
        numOfItems = fieldConfig.numOfItems;
        numOfBombs = fieldConfig.numOfBombs;
    }

    function sendInfoToOpponent (gameFinished, gameResult) {
        conn.send({
            type: 'gameAction',
            payload: {
                levelConfig,
                score,
                gameFinished,
                gameResult
            }
        });
        if (gameFinished) {
            // prevent clicking on items
            field.removeEventListener('click', onItemClick);

            updateScore();
            scoreByGames.me = gameResult.me ? scoreByGames.me + 1 : scoreByGames.me;
            scoreByGames.opponent = gameResult.opponent ? scoreByGames.opponent + 1 : scoreByGames.opponent;
            updateScoreByGames();
            restartGame();
            startCountdown();
        }
    }

    function updateScore () {
        scoreDiv.firstElementChild.innerHTML = score.me;
        scoreDiv.lastElementChild.innerHTML = score.opponent;
    }

    function updateScoreByGames () {
        scoreByGamesDiv.firstElementChild.innerHTML = scoreByGames.me;
        scoreByGamesDiv.lastElementChild.innerHTML = scoreByGames.opponent;
    }

    function onItemClick (e) {
        let value = e.target.dataset.value;
        if (!value) {
            return;
        }
        let gameFinished;
        let gameResult;
        if (value === 'bomb') {
            gameFinished = true;
            gameResult = {me: false, opponent: true};
        }
        if (value === 'item') {
            score.me += 1;
            updateScore();
            numOfItems -= 1;
            if (!numOfItems) {
                gameFinished = true;
                gameResult = {me: score.me > score.opponent, opponent: score.me < score.opponent};
            }
        }
        e.target.classList.remove(value);
        e.target.dataset.value = 'empty';

        let row = parseInt(e.target.dataset.row);
        let col = parseInt(e.target.dataset.col);
        levelConfig[row][col] = 'empty';
        sendInfoToOpponent(gameFinished, gameResult);
    }

    function setField (config) {
        while (field.firstChild) {
            field.removeChild(field.firstChild);
        }
        levelConfig = config;
        for (let i = 0; i < fieldConfig.rows; i++) {
            for(let j = 0; j < fieldConfig.cols; j++) {
                let elem = document.createElement('div');
                let value = levelConfig[i][j];
                elem.classList.add('cell');
                elem.classList.add(value);
                elem.dataset.value = value;
                elem.dataset.row = i;
                elem.dataset.col = j;
                field.appendChild(elem);
            }
        }
    }

    function onGameAction (data) {
        setField(data.levelConfig);
        // set score
        score = {
            me: data.score.opponent,
            opponent: data.score.me
        };
        updateScore();
        if (data.gameFinished) {
            console.log('game finished');
            field.removeEventListener('click', onItemClick);
            scoreByGames.me = data.gameResult.opponent ? scoreByGames.me + 1 : scoreByGames.me;
            scoreByGames.opponent = data.gameResult.me ? scoreByGames.opponent + 1 : scoreByGames.opponent;
            updateScoreByGames();
            startCountdown();
            restartGame();
            return;
        }
        numOfItems -= 1;
    }

    function onGameStart (data) {
        score = {
            me: 0,
            opponent: 0
        };
        updateScore();
        statusDiv.innerHTML = 'Game with: ' + conn.peer;
        stopCountdown();
        setField(data.levelConfig);
        field.addEventListener('click', onItemClick);
        // show the field
        fieldContainer.style.display = 'block';
        field.style.width = fieldConfig.width + 'px';
        field.style.height = fieldConfig.height + 'px';
        scale();
    }

    function startCountdown () {
        countdownDiv.style.opacity = '1';
        let val = 3;
        countdownValue.innerHTML = val--;
        countdownInterval = setInterval(function () {countdownValue.innerHTML = val--;}, 1000);
    }

     function stopCountdown () {
        clearInterval(countdownInterval);
        countdownDiv.style.opacity = '0';
    }

    /**
     * Create the Peer object for our end of the connection.
     *
     * Sets up callbacks that handle any events related to our
     * peer object.
     */
     function initialize() {
        // Create own peer object with connection to shared PeerJS server
        // peer = new Peer('538cf957-0ba3-486f-90c5-957569cbb9cd', {
        peer = new Peer(null, {
            debug: 2
        });
        peer.on('open', function (id) {
            // Workaround for peer.reconnect deleting previous id
            if (peer.id === null) {
                console.log('Received null id from peer open');
                peer.id = lastPeerId;
            } else {
                lastPeerId = peer.id;
            }
            console.log('ID: ' + peer.id);
            myIdDiv.innerHTML = 'my id: ' + peer.id;
        });
        peer.on('connection', function (c) {
            // Allow only a single connection
            if (conn) {
                c.on('open', function() {
                    c.send({type: 'alreadyConnected', text: 'Already connected to another client'});
                    setTimeout(function() { c.close(); }, 500);
                });
                return;
            }
            conn = c;
            console.log('Connected to: ' + conn.peer);
            statusDiv.innerHTML = 'connected to ' + conn.peer;

            // Handle incoming data
            conn.on('data', function (data) {
                switch (data.type) {
                    case 'askForGame':
                        onGameInvitation();
                        break;
                    case 'gameStarted':
                        onGameStart(data.payload);
                        break;
                     case 'gameAction':
                        onGameAction(data.payload);
                        break;
                    default:
                        break;
                }
            });
        });
        peer.on('disconnected', function () {
            console.log('Connection lost. Please reconnect');
            statusDiv.innerHTML = 'Connection lost. Please reconnect';
            // Workaround for peer.reconnect deleting previous id
            peer.id = lastPeerId;
            peer._lastServerId = lastPeerId;
            peer.reconnect();
        });
        peer.on('close', function() {
            conn = null;
            console.log('Connection destroyed');
            statusDiv.innerHTML = 'Connection destroyed. Please refresh';
        });
        peer.on('error', function (err) {
            console.log(err);
            statusDiv.innerHTML = err;
        });
    }
    initialize();
})();
