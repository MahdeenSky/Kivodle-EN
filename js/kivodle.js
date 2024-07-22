const maxTries = 5;
const speedrunMaxStreak = 10;
const weapons = Object.freeze(['SG', 'SMG', 'AR', 'GL', 'HG', 'RL', 'SR', 'RG', 'MG', 'MT', 'FT']);
const classes = Object.freeze({ 0b00001: 'Tank', 0b00010: 'Attacker', 0b00100: 'Healer', 0b01000: 'Support', 0b10000: 'T.S' });
const schools = Object.freeze(['Byakuyakou', 'Red Winter', 'Trinity', 'Gehenna', 'Abydos', 'Millennium', 'Arius', 'Shanhaijing', 'Valkyrie', 'SRT', 'Others']);
const attackTypes = Object.freeze(['Explosion', 'Penetration', 'Mystic', 'Sonic']);
const modes = Object.freeze({ daily: 'Daily', endless: 'Endless', speedrun: 'Speedrun' });
const same = 'same';
const wrong = 'wrong';
const before = 'Before'; // Adjusted capitalization for consistency
const after = 'After';  // Adjusted capitalization for consistency

// Local Storage Keys
const keyGeneralVisited = 'Kivodle.General.Visited';
const keyDailyLastPlayed = 'Kivodle.Daily.LastPlayed';
const keyDailyGuesses = 'Kivodle.Daily.Guesses';
const keyDailyWinStreak = 'Kivodle.Daily.WinStreak';
const keyEndlessTarget = 'Kivodle.Endless.Target';
const keyEndlessGuesses = 'Kivodle.Endless.Guesses';
const keyEndlessCorrects = 'Kivodle.Endless.Corrects';
const keyEndlessHighScore = 'Kivodle.Endless.HighScore';
const keySpeedrunHighScore = 'Kivodle.Speedrun.HighScore';

// Global Variables
let target;
let tries;
let corrects = 0;
let currentMode;
let implementedStudents;
let guesses = [];
let speedrunStart;
let speedrunSum;
let intervalId;
let judges = [];
const now = getToday();

// Function to get today's date (adjusted for UTC time)
function getToday() {
    const today = new Date();
    if (today.getUTCHours() >= 19) {
        today.setUTCDate(today.getUTCDate() + 1);
    }
    return today;
}

// Function to get data from LocalStorage
function getLocalStorage(key) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
}

// Function to set data in LocalStorage
function setLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// Function to remove data from LocalStorage
function removeLocalStorage(key) {
    localStorage.removeItem(key);
}

// Function to convert Katakana to Hiragana
function convertToHiragana(str) {
    return str.replace(/[\u30a1-\u30f6]/g, function (match) {
        const chrCode = match.charCodeAt(0) - 0x60;
        return String.fromCharCode(chrCode);
    }).toLowerCase();
}

// Execute once when the page loads
function pageLoad() {
    const yesterdayStr = `${now.getUTCFullYear()}/${now.getUTCMonth() + 1}/${now.getUTCDate() - 1}`;
    implementedStudents = students.filter(student => guessDate(student.data.implementationDate, yesterdayStr) !== after);

    currentMode = modes.daily; // Default to Daily Mode on load
    setup();

    // Populate dropdown list with student names
    implementedStudents.forEach(student => {
        $('#selectGuess').append(
            $('<option>')
                .html(student.studentName)
                .val(student.studentName)
                .attr('data-search-hiragana', convertToHiragana(student.studentName))
        );
    });

    // Initialize Select2 with custom width and search matcher
    $('#selectGuess').select2({
        width: 'resolve', 
        matcher: (params, data) => {
            const term = $.trim(params.term);
            if (term === '') return data;

            const text = data.text || '';
            const hiragana = $(data.element).data('search-hiragana') || '';

            if (text.indexOf(term) > -1 || hiragana.indexOf(term) > -1) {
                return $.extend({}, data, true); // Return a copy of the data object
            }

            return null;
        }
    });

    // Display the about modal if this is the user's first visit
    if (!getLocalStorage(keyGeneralVisited)) {
        setLocalStorage(keyGeneralVisited, true);
        openModal();
    }

    // Attach event listeners to mode switching links
    $('#menuBar a').on('click', function(event) {
        event.preventDefault(); // Prevent default link behavior
        const mode = $(this).data('mode');
        switchMode(mode);
    });

    // Attach event listener to "Guess" button
    $('#buttonGuess').on('click', () => {
        answerProcess($('#selectGuess').val());
    });

    // Event listener for opening the modal
    $('#openModalBtn').on('click', function(event) {
        event.preventDefault();
        openModal();
    });

    // Event listener for closing the modal
    $('#modalClose, #modalOverlay').on('click', closeModal);

}

// Function to initialize or reset the game
function setup(nextFlg = false) {
    tries = 0;
    guesses = [];
    judges = [];

    setTriesAreaInGame();
    $('#guessArea').removeClass('fold');
    $('#infoArea').removeClass(same).removeClass(wrong);
    $('#checkGridBody').empty();
    $('#infoButtonArea').remove();
    $('#resultArea').empty();
    $('#buttonGuess').prop('disabled', false);

    switch (currentMode) {
        case modes.daily:
            setupDailyMode();
            break;
        case modes.endless:
            setupEndlessMode(nextFlg);
            break;
        case modes.speedrun:
            setupSpeedrunMode();
            break;
        default:
            currentMode = modes.daily;
            setupDailyMode();
    }
}

// Function to set up the Daily Mode
function setupDailyMode() {
    setTarget(now.getUTCFullYear() * 10000 + now.getUTCMonth() * 100 + now.getUTCDate());

    const todayStr = `${now.getUTCFullYear()}/${now.getUTCMonth() + 1}/${now.getUTCDate()}`;
    const lastPlayed = getLocalStorage(keyDailyLastPlayed);

    if (lastPlayed && guessDate(todayStr, lastPlayed) === same) {
        guesses = getLocalStorage(keyDailyGuesses) || [];
        answerForLoad();
    } else {
        removeLocalStorage(keyDailyGuesses);
        setLocalStorage(keyDailyLastPlayed, todayStr);
    }

    setModeInfoAreaForDaily();
}

function setupEndlessMode() {
    setTarget(Date.now());
    setLocalStorage(keyEndlessTarget, target.studentName);
    removeLocalStorage(keyEndlessGuesses);
    corrects = 0;
    setLocalStorage(keyEndlessCorrects, corrects);

    setModeInfoAreaForEndless();
}

function setupSpeedrunMode() {
    corrects = 0;
    speedrunSum = 0;
    $('#guessArea').addClass('fold');
    $('#triesArea').empty();
    $('#infoArea').append($('<div>').attr('id', 'infoButtonArea'));
    insertSingleButton('startButton', 'Start', () => startSpeedrun(false));
    setWinStreakAreaForSpeedrun();
}

// Function to handle answer processing after loading saved data
function answerForLoad() {
    guesses.forEach(guess => {
        answerProcess(guess, true);
    });
}



// Function to start the Speedrun timer
function startSpeedrun(nextFlg) {
    tries = 0;
    setTarget(Date.now());

    guesses = [];
    judges = [];
    setupDom();
    setTriesAreaInGame();

    if (!nextFlg) {
        speedrunSum = 0;
    }
    speedrunStart = Date.now();
    setModeInfoAreaForSpeedrunInGame(speedrunSum);
    intervalId = setInterval(() => {
        setModeInfoAreaForSpeedrunInGame(speedrunSum + (Date.now() - speedrunStart));
    }, 100);

    $('#guessArea').removeClass('fold'); // Show the guess area when Speedrun starts
    $('#buttonGuess').prop('disabled', false); 
}

// Function to update the 'triesArea' element during the game
function setTriesAreaInGame() {
    $('#triesArea').html(`Guesses: ${tries} / ${maxTries}`);
}

// Function to set the content of the 'modeInfoArea' for Daily Mode
function setModeInfoAreaForDaily() {
    $('#modeNameArea').html('Daily Mode');
    $('#modeStatsArea').html(`Win Streak: ${getLocalStorage(keyDailyWinStreak) || 0}`);
}

// Function to set the content of the 'modeInfoArea' for Endless Mode
function setModeInfoAreaForEndless() {
    $('#modeNameArea').html(`Endless Mode<br>Current Score: ${corrects}`);
    $('#modeStatsArea').html(`High Score: ${getLocalStorage(keyEndlessHighScore) || 0}`);
}

// Function to update the 'modeInfoArea' during Speedrun Mode
function setModeInfoAreaForSpeedrunInGame(millisecond) {
    const totalSeconds = Math.floor(millisecond / 1000);
    const formattedTime = `${Math.floor(totalSeconds / 60).toString().padStart(2, '0')}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
    $('#modeNameArea').html(`Speedrun Mode<br>Correct: ${corrects} / ${speedrunMaxStreak}<br>Time: ${formattedTime}`);
}

// Function to display the high score for Speedrun Mode
function setWinStreakAreaForSpeedrun() {
    const highScore = getLocalStorage(keySpeedrunHighScore);
    $('#modeStatsArea').html(`High Score: ${highScore ? millisecondToEncodedStr(highScore) : 'No Record'}`);
}

// Function to randomly select the correct answer (target)
function setTarget(seed) {
    const mt = new MersenneTwister(seed);
    const randomIndex = mt.nextInt(0, implementedStudents.length);
    target = implementedStudents[randomIndex];
}

// Function to switch between game modes
function switchMode(targetMode) {
    if (currentMode === targetMode) {
        return;
    }

    if (intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
    }

    currentMode = modes[targetMode];

    // Reset game state
    tries = 0;
    guesses = [];
    judges = [];
    corrects = 0;

    // Clear the game board
    $('#checkGridBody').empty();
    $('#resultArea').empty();
    $('#infoButtonArea').remove();

    // Update UI for the new mode
    $('#guessArea').removeClass('fold');
    $('#buttonGuess').prop('disabled', false);

    // Set up the new mode
    setup();

    // Update the active state in the menu
    $('#menuBar a').removeClass('active');
    $(`#menuBar a[data-mode="${targetMode}"]`).addClass('active');

    // Update mode-specific elements
    switch (targetMode) {
        case 'daily':
            setModeInfoAreaForDaily();
            break;
        case 'endless':
            setModeInfoAreaForEndless();
            break;
        case 'speedrun':
            setupSpeedrunMode();
            break;
    }
}

// Function to process the player's guess
function answerProcess(guessedName, loadFlg = false) {
    $('#buttonGuess').prop('disabled', true);

    const guessed = implementedStudents.find(student => student.studentName === guessedName);

    if (!guessed || (!loadFlg && guesses.includes(guessedName))) {
        $('#buttonGuess').prop('disabled', false);
        return; 
    }

    const judgeObj = guess(guessed);
    judges.push(judgeObj);
    prependTableRow(guessed, judgeObj);
    tries++;

    if (!loadFlg) {
        guesses.push(guessedName);
        if (currentMode === modes.daily) {
            setLocalStorage(keyDailyGuesses, guesses);
        } else if (currentMode === modes.endless) {
            setLocalStorage(keyEndlessGuesses, guesses);
        }
    }

    if (judgeObj.isHit === same || tries === maxTries) {
        endGame(judgeObj.isHit, loadFlg); 
    } else {
        setTriesAreaInGame();
        $('#buttonGuess').prop('disabled', false);
    }
}

// Function to compare the guessed student with the target
function guess(guessed) {
    const judgeSameOrWrong = (a, b) => a === b ? same : wrong;
    const judgeSameOrWrongBitwise = (a, b) => (a & b) !== 0 ? same : wrong;

    return {
        isHit: judgeSameOrWrong(target.studentName, guessed.studentName),
        isSameWeapon: judgeSameOrWrong(target.data.weapon, guessed.data.weapon),
        isSameClass: judgeSameOrWrongBitwise(target.data.class, guessed.data.class),
        isSameSchool: judgeSameOrWrong(target.data.school, guessed.data.school),
        isSameAttackType: judgeSameOrWrong(target.data.attackType, guessed.data.attackType),
        isSameImplDate: guessDate(target.data.implementationDate, guessed.data.implementationDate)
    };
}

function prependTableRow(guessed, judgeObj) {
    const $newRow = $('<tr>').addClass('guessing');

    function createCell(content, isCorrect) {
        return $('<td>')
            .addClass(isCorrect)
            .html(content);
    }

    $newRow.append(createCell(guessed.studentName, judgeObj.isHit));
    $newRow.append(createCell(weapons[guessed.data.weapon], judgeObj.isSameWeapon));

    const classNames = Object.entries(classes)
        .filter(([mask, className]) => (guessed.data.class & mask) !== 0)
        .map(([mask, className]) => className)
        .join('<br>');
    $newRow.append(createCell(classNames, judgeObj.isSameClass));

    $newRow.append(createCell(schools[guessed.data.school], judgeObj.isSameSchool));
    $newRow.append(createCell(attackTypes[guessed.data.attackType], judgeObj.isSameAttackType));

    const implDateContent = `${guessed.data.implementationDate}<br>${judgeObj.isSameImplDate !== same ? judgeObj.isSameImplDate : ''}`;
    $newRow.append(createCell(implDateContent, judgeObj.isSameImplDate === same ? same : wrong));

    $('#checkGridBody').prepend($newRow);

    setTimeout(() => {
        $newRow.removeClass('guessing');
    }, 500);
}

// Function to handle the end of the game
function endGame(isHit, loadFlg = false) {
    // Update the attempts counter to show the final attempt
    setTriesAreaInGame();

    const result = `${isHit === same ? 'Correct!' : 'Incorrect...'} The answer was "${target.studentName}".`;
    $('#resultArea').html(result).addClass(isHit);
    $('#guessArea').addClass('fold');
    $('#infoArea').append($('<div>').attr('id', 'infoButtonArea'));

    if (currentMode === modes.daily || (currentMode === modes.endless && isHit === wrong)) {
        const shareStr = currentMode === modes.endless ? createShareStrForEndless() : createShareStrForDaily();
        insertShareButton(shareStr);

        if (currentMode === modes.endless) {
            insertRetryButton();
            corrects = 0;
            removeLocalStorage(keyEndlessTarget);
            removeLocalStorage(keyEndlessCorrects);
            removeLocalStorage(keyEndlessGuesses);
        } else if (!loadFlg) {
            let winStreak = getLocalStorage(keyDailyWinStreak) || 0;
            setLocalStorage(keyDailyWinStreak, isHit === same ? winStreak + 1 : 0);
            setModeInfoAreaForDaily(); 
        }
    } else if (currentMode === modes.endless) {
        if (!loadFlg) {
            setLocalStorage(keyEndlessCorrects, ++corrects);
            if (corrects > (getLocalStorage(keyEndlessHighScore) || 0)) {
                setLocalStorage(keyEndlessHighScore, corrects);
            }
            setModeInfoAreaForEndless(); 
        }
        insertSingleButton('nextButton', 'Next', () => setup(true));
    } else if (currentMode === modes.speedrun) {
        speedrunSum += Date.now() - speedrunStart;
        clearInterval(intervalId);
        corrects += isHit === same ? 1 : 0;
        setModeInfoAreaForSpeedrunInGame(speedrunSum);

        if (corrects >= speedrunMaxStreak) {
            const encodedTime = millisecondToEncodedStr(speedrunSum);
            $('#resultArea').append($('<div>').html(`You solved ${speedrunMaxStreak} questions in ${encodedTime}!`));
            if (!getLocalStorage(keySpeedrunHighScore) || speedrunSum < getLocalStorage(keySpeedrunHighScore)) {
                setLocalStorage(keySpeedrunHighScore, speedrunSum);
            }
            setWinStreakAreaForSpeedrun(); 
            insertShareButton(createShareStrForSpeedrun(encodedTime));
            insertRetryButton(); 
        } else {
            insertSingleButton('nextButton', 'Next', () => startSpeedrun(true));
        }
    }
}

// Function to create the share string for Daily Mode
function createShareStrForDaily() {
    let shareStr = `#Kivodle Daily - ${judges.length}/5 \n\n`; // Using /5 for a more standard Wordle format
    for (let i = judges.length - 1; i >= 0; i--) {
        shareStr += judges[i].isHit === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameWeapon === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameClass === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameSchool === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameAttackType === same ? '🟩' : '🟥';
        shareStr += judges[i].isSameImplDate === same ? '🟩' : '🟥';
        shareStr += '\n';
    }
    shareStr += `\n${location.href}`; // Add the game URL to the share string
    return shareStr;
}

// Function to create the share string for Endless Mode
function createShareStrForEndless() {
    return `#Kivodle Endless - I got ${corrects} correct in a row! \n\n${location.href}`; 
}

// Function to create the share string for Speedrun Mode
function createShareStrForSpeedrun(record) {
    return `#Kivodle Speedrun - I completed ${speedrunMaxStreak} questions in ${record}! \n\n${location.href}`;
}

// Function to add buttons for sharing on different platforms
function insertShareButton(shareStr) {
    const $shareButtonArea = $('<div>').attr('id', 'shareButtonArea').appendTo($('#infoButtonArea'));

    function addButton(id, text, url = null) {
        const $button = $('<button>')
            .attr('id', id)
            .addClass('btn btn-cyan')
            .text(text)
            .appendTo($shareButtonArea);

        if (url) {
            $button.on('click', () => window.open(url)); 
        }
    }

    addButton('copyButton', 'Copy');
    addButton('xButton', 'Share on X', `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareStr)}`);
    addButton('misskeyButton', 'Share on Misskey', `https://misskey-hub.net/share/?text=${encodeURIComponent(shareStr)}&visibility=public&localOnly=0`);
    addButton('mastodonButton', 'Share on Mastodon', `https://donshare.net/share.html?text=${encodeURIComponent(shareStr)}`); 

    $('#copyButton').on('click', () => {
        navigator.clipboard.writeText(shareStr).then(() => {
            $('#copyButton').text('Copied!');
            setTimeout(() => $('#copyButton').text('Copy'), 1000);
        });
    });
}

// Function to reset the DOM and prepare for a new game
function setupDom() {
    $('#triesArea').html(`Guesses: 0 / ${maxTries}`);
    $('#guessArea').removeClass('fold');
    $('#infoArea').removeClass(same).removeClass(wrong);
    $('#checkGridBody').empty();
    $('#infoButtonArea').remove();
    $('#buttonGuess').prop('disabled', false); 
}

// Function to add a single button to the UI
function insertSingleButton(id, text, clickHandler) {
    // make sure button with the same id doesn't exist before creating a new one
    if ($(`#${id}`).length) return;

    const $buttonArea = $('#infoButtonArea').length ? $('#infoButtonArea') : $('<div>').attr('id', 'infoButtonArea').appendTo($('#infoArea'));
    $('<button>')
        .attr('id', id)
        .addClass('btn btn-yellow')
        .text(text)
        .on('click', clickHandler)
        .appendTo($buttonArea);
}

// Function to add a "Retry" button
function insertRetryButton() {
    insertSingleButton('retryButton', 'Retry', () => setup());
}

// Function to compare dates
function guessDate(targetDateStr, guessDateStr) {
    const [targetYear, targetMonth, targetDay] = targetDateStr.split('/').map(Number);
    const [guessYear, guessMonth, guessDay] = guessDateStr.split('/').map(Number);

    if (targetYear > guessYear) return after;
    if (targetYear < guessYear) return before;
    if (targetMonth > guessMonth) return after;
    if (targetMonth < guessMonth) return before;
    if (targetDay > guessDay) return after;
    if (targetDay < guessDay) return before;
    return same;
}

// Function to convert milliseconds to a formatted time string
function millisecondToEncodedStr(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    const millisecondsPart = (milliseconds % 1000).toString().padStart(3, '0'); 
    return `${minutes}:${seconds}.${millisecondsPart}`; 
}

// Function to open the modal
function openModal() {
    $('#modalOverlay').addClass('open');
    $('#modal').addClass('open');
}

// Function to close the modal
function closeModal() {
    $('#modalOverlay').removeClass('open');
    $('#modal').removeClass('open');
}

// Call pageLoad when the document is ready
$(document).ready(pageLoad);