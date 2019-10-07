(function () {
    let lastPeerId = null;
    let peer = null; // own peer object
    let conn = null;

    const statusDiv = document.getElementById('send__status');
    const startButtonContainer = document.getElementById('send__start-container');
    const startButton = document.getElementById('send__start');
    const connectContainer = document.getElementById('send__connect-container');
    const connectButton = document.getElementById('send__connect-button');
    const fieldContainer = document.getElementById('send__field-container');
    const field = document.getElementById('send__field');
    const countdownDiv = document.getElementById('send__countdown');
    const countdownValue = document.getElementById('send__countdown-value');
    const idToConnectInput = document.getElementById('send__id-to-connect');
    const myIdDiv = document.getElementById('send__my-id');
    const scoreContainerDiv = document.getElementById('send__score-common-container');
    const scoreDiv = document.getElementById('send__score');
    const scoreByGamesDiv = document.getElementById('send__score-by-games');

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

    let levelConfig = [[], [], [], [], [], [], [], [], [], [], [], []];
    let numOfItems = fieldConfig.numOfItems;
    let numOfBombs = fieldConfig.numOfBombs;
    let fieldData = {
        itemsCoordinates: [],
        bombsCoordinates : []
    };
    let score = {
        me: 0,
        opponent: 0
    };
    let scoreByGames = {
        me: 0,
        opponent: 0
    };

    function scale () {
        let width = document.documentElement.clientWidth;
        let k = width / fieldConfig.width;
        if (k < 1) {
            fieldContainer.style.transform = `scale(${k})`;
        }
    }
    window.addEventListener('resize', scale);

    startButton.addEventListener('click', askForGame);
    connectButton.addEventListener('click', join);

    function askForGame () {
        conn.send({
            type: 'askForGame'
        });
        startButtonContainer.style.display = 'none';
        statusDiv.innerHTML = 'Waiting for response of ' + conn.peer;
    }

    function restartGame () {
        numOfItems = fieldConfig.numOfItems;
        numOfBombs = fieldConfig.numOfBombs;
        levelConfig = [[], [], [], [], [], [], [], [], [], [], [], []];
        fieldData = {
            itemsCoordinates: [],
            bombsCoordinates : []
        };
        score = {
            me: 0,
            opponent: 0
        };
        updateScore();
        onGameStart();
    }

    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function generateField () {
        while (field.firstChild) {
            field.removeChild(field.firstChild);
        }
        for (let i = 0; i < fieldConfig.numOfBombs; i++) {
            // obj mustn't be duplicated
            let x = getRandomInt(0, 11);
            let y = getRandomInt(0, 11);
            while (fieldData.bombsCoordinates.some(item => item.x === x && item.y === y)) {
                x = getRandomInt(0, 11);
                y = getRandomInt(0, 11);
            }
            const obj = {x, y};
            fieldData.bombsCoordinates.push(obj);
        }
        // bombs mustn't match to items
        for (let i = 0; i < fieldConfig.numOfItems; i++) {
            // obj mustn't be duplicated
            let x = getRandomInt(0, 11);
            let y = getRandomInt(0, 11);
            while (fieldData.itemsCoordinates.some(item => item.x === x && item.y === y) || fieldData.bombsCoordinates.some(item => item.x === x && item.y === y)) {
                x = getRandomInt(0, 11);
                y = getRandomInt(0, 11);
            }
            const obj = {x, y};
            fieldData.itemsCoordinates.push(obj);
        }

        levelConfig.map((row) => {
            for (let i = 0; i < fieldConfig.cols; i++) {
                row.push('empty');
            }
        });
        fieldData.itemsCoordinates.map(coord => {
            levelConfig[coord.y][coord.x] = 'item';
        });
        fieldData.bombsCoordinates.map(coord => {
            levelConfig[coord.y][coord.x] = 'bomb';
        });
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
            startCountdown();
            setTimeout(restartGame, 3000);
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
            field.removeEventListener('click', onItemClick);
            scoreByGames.me = data.gameResult.opponent ? scoreByGames.me + 1 : scoreByGames.me;
            scoreByGames.opponent = data.gameResult.me ? scoreByGames.opponent + 1 : scoreByGames.opponent;
            updateScoreByGames();
            startCountdown();
            setTimeout(restartGame, 3000);
            return;
        }
        numOfItems -= 1;
    }

    function onGameStart () {
        stopCountdown();
        generateField();
        // send data to receive.js and start the game
        conn.send({
            type: 'gameStarted',
            payload: {
                levelConfig
            }
        });

        setField(levelConfig);
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

    function initGame () {
        console.log('invitation has been accepted');
        startButtonContainer.style.display = 'none';
        statusDiv.innerHTML = 'Game with: ' + conn.peer;
        scoreContainerDiv.style.display = 'flex';
        console.log('game will start in 3 sec');
        startCountdown();

        setTimeout(onGameStart, 3000);
    }

    function notInitGame () {
        console.log('notInitGame ---');
        console.log('invitation has been declined');
        statusDiv.innerHTML = conn.peer + ' has declained your invitation';
    }

    /**
     * Create the Peer object for our end of the connection.
     *
     * Sets up callbacks that handle any events related to our
     * peer object.
     */
    function initialize() {
        // Create own peer object with connection to shared PeerJS server
        // peer = new Peer('e7e4b42f-0053-4a6c-b8c6-a2ca92ca25b9', {
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

            // join();// join immediately for test purpose
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
    /**
     * Create the connection between the two Peers.
     *
     * Sets up callbacks that handle any events related to the
     * connection and data received on it.
     */
    function join() {
        // Close old connection
        if (conn) {
            conn.close();
        }

        let id = idToConnectInput.value.trim();
        if (!id) {
            return;
        }

        // conn = peer.connect('538cf957-0ba3-486f-90c5-957569cbb9cd', {
        conn = peer.connect(id, {
            reliable: true
        });
        conn.on('open', function () {
            console.log('Connected to: ' + conn.peer);
            statusDiv.innerHTML = 'connected to ' + conn.peer;

            // add button to start game;
            startButtonContainer.style.display = 'block';

            idToConnectInput.value = '';
            connectContainer.style.display = 'none';
        });
        // Handle incoming data
        conn.on('data', function (data) {
            switch (data.type) {
                case 'askForGame':
                    if (data.payload.accepted) {
                        initGame();
                    } else {
                        notInitGame();
                    }
                    break;
                case 'gameAction':
                    onGameAction(data.payload);
                    break;
                case 'alreadyConnected':
                    console.log('alreadyConnected ---');
                    connectContainer.style.display = 'block';
                    // disable button to start game
                    startButtonContainer.style.display = 'none';
                    statusDiv.innerHTML = conn.peer + ' is ' + data.text;
                    break;
                default:
                    break;
            }
        });
    }
    initialize();
})();
