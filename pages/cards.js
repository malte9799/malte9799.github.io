const rows = 13;
const cols = 4;
const width = 19;
const height = 27;
const suits = ['H', 'D', 'C', 'S'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

let div_cards = document.querySelector('.cards');
for (let j = 0; j < cols; j++) {
	for (let i = rows - 1; i >= 0; i--) {
		let div_card = document.createElement('div');
		div_card.id = ranks[i] + suits[j];
		div_card.classList.add('card');
		div_card.style.backgroundPosition = '-' + width * i + 'px -' + height * j + 'px';
		div_cards.appendChild(div_card);
	}
}

document.querySelectorAll('.card').forEach((card) => {
	card.addEventListener('click', (e) => {
		card.classList.toggle('selected');
	});
});

// var valuesArray = [];
// var suitsArray = [];

// function checkHand() {
// 	var resultString = '';
// 	for (var i = 0; i < 5; i++) {
// 		hand[i] = document.getElementById('card_' + i).value;
// 	}
// 	convertHand();
// 	console.log(duplicateCards());
// 	switch (duplicateCards()) {
// 		case '2':
// 			resultString = '1 Pair';
// 			break;
// 		case '22':
// 			resultString = '2 Pairs';
// 			break;
// 		case '3':
// 			resultString = '3 of a Kind';
// 			break;
// 		case '23':
// 		case '32':
// 			resultString = 'Full House';
// 			break;
// 		case '4':
// 			resultString = '4 of a Kind';
// 			break;
// 		case '5':
// 			resultString = '5 of a Kind';
// 			break;
// 		default:
// 			if (isStraight()) {
// 				resultString = 'Straight';
// 			}
// 			if (isAceStraight()) {
// 				resultString = 'Ace Straight';
// 			}
// 			break;
// 	}
// 	if (isFlush()) {
// 		if (resultString) {
// 			resultString += ' and Flush';
// 		} else {
// 			resultString = 'Flush';
// 		}
// 	}
// 	if (!resultString) {
// 		resultString = 'nothing...';
// 	}
// 	document.getElementById('result').innerHTML = resultString;
// }

// function convertHand() {
// 	for (var i = 0; i < 5; i++) {
// 		valuesArray[i] = hand[i] % 13;
// 		suitsArray[i] = Math.floor(hand[i] / 13);
// 	}
// }

// function isFlush() {
// 	for (var i = 0; i < 4; i++) {
// 		if (suitsArray[i] != suitsArray[i + 1]) {
// 			return false;
// 		}
// 	}
// 	return true;
// }

// function isStraight() {
// 	var lowest = getLowest();
// 	for (var i = 1; i < 5; i++) {
// 		if (occurrencesOf(lowest + i) != 1) {
// 			return false;
// 		}
// 	}
// 	return true;
// }

// function isAceStraight() {
// 	var lowest = 9;
// 	for (var i = 1; i < 4; i++) {
// 		if (occurrencesOf(lowest + i) != 1) {
// 			return false;
// 		}
// 	}
// 	return occurrencesOf(1) == 0;
// }

// function getLowest() {
// 	var min = 12;
// 	for (var i = 0; i < valuesArray.length; i++) {
// 		min = Math.min(min, valuesArray[i]);
// 	}
// 	return min;
// }

// function duplicateCards() {
// 	var occurrencesFound = [];
// 	var result = '';
// 	for (var i = 0; i < valuesArray.length; i++) {
// 		var occurrences = occurrencesOf(valuesArray[i]);
// 		if (occurrences > 1 && occurrencesFound.indexOf(valuesArray[i]) == -1) {
// 			result += occurrences;
// 			occurrencesFound.push(valuesArray[i]);
// 		}
// 	}
// 	return result;
// }

// function occurrencesOf(n) {
// 	var count = 0;
// 	var index = 0;
// 	do {
// 		index = valuesArray.indexOf(n, index) + 1;
// 		if (index == 0) {
// 			break;
// 		} else {
// 			count++;
// 		}
// 	} while (index < valuesArray.length);
// 	return count;
// }
