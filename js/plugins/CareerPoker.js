//=============================================================================
// TrumpGame.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc トランプのゲーム「大富豪」の実装プラグインです。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

var Scene_CareerPoker;

(function() {
	'use strict';
	Scene_CareerPoker = class extends Scene_MenuBase {
		create() {
			super.create();
			this._cardSprites = new Sprite_Cardset();
			this.addChild(this._cardSprites);
			this._handWindow = new Window_Hand(this._cardSprites, 0, 330);
			this._handWindow.setTurnEndHandler(this.onTurnEnd.bind(this));
			this.addWindow(this._handWindow);

			var bitmap = ImageManager.loadBitmap('img/trump/btn_', 'green', 0, true);
			bitmap.addLoadListener(function() {
				bitmap.drawText('始める', 0, 0, 200, 50, 'center');
			});
			this._startButton = new Sprite_Button();
			this._startButton.bitmap = bitmap;
			this._startButton.move((816 - 190) / 2, (624 - 104) / 2);
			this._startButton.setClickHandler(this.deck.bind(this));
			this._startButton.visible = false;
			this.addChild(this._startButton);

			var points = [0, 200, 50, 50, 466, 50, 516, 200];
			this._playerWindows = [];
			for (var i = 0; i < 4; i++) {
				this._playerWindows[i] = new Window_Player(points[i * 2], points[i * 2 + 1]);
				this.addWindow(this._playerWindows[i]);
			}

			var y = this._handWindow.y + this._handWindow.height;
			var rect = new Rectangle(0, y, 500, Graphics.boxHeight - y);
			var exRect = new Rectangle(0, 0, Graphics.boxWidth, y);
			this._chatLogWindow = new Window_Chat(rect, exRect);
			this._chatLogWindow.setWindowHandler(this._handWindow);
			this.addChild(this._chatLogWindow);
		}

		isReady() {
			return !!OnlineManager.user && super.isReady();
		}

		start() {
			var roomRef = firebase.database().ref('rooms').child('0');
			var usersRef = roomRef.child('users');
			var selfRef = usersRef.child(OnlineManager.user.uid);
			this._cardRef = roomRef.child('card');
			this._deckRef = roomRef.child('deck');
			this._chatRef = roomRef.child('chat');
			var connectedRef = firebase.database().ref('.info/connected');
			connectedRef.on('value', function(data) {
				if (data.val()) selfRef.onDisconnect().remove();
			});

			this._cardRef.on('child_added', function(data) {
				var c = data.val();
				if (c instanceof Array) for (var b of c) b.toString = Card.prototype.toString;
				this.putCards(c);
				this._turnIndex++;
				if (this._turnIndex === this._playerCount) this._turnIndex = 0;
			}.bind(this));

			this._deckRef.on('value', function(data) {
				if (!data.val()) return;
				this.clear();
				var cards = data.val()[this._myIndex];
				if (!cards) return;
				for (var b of cards) b.toString = Card.prototype.toString;
				this._handWindow.setCards(cards, true);
				this._handWindow.activate();
			}.bind(this));

			this._chatRef.on('child_added', function(data) {
				this._chatLogWindow.pushLog(data.val());
			}.bind(this));

			this._cardRef.remove();this._turnIndex = 0;

			usersRef.on('value', function(data) {
				var i = 0;
				var users = data.val();
				var isPlayer = false;
				for (var key in users) {
					if (key === OnlineManager.user.uid) {
						this._myIndex = i;
						isPlayer = true;
						if (i === 0) {
							this._isHost = true;
							this._startButton.visible = true;
						} else this._startButton.visible = false;
					}
					this._playerWindows[i++].setup(users[key]);
					if (i === 4) break;
				}
				this._playerCount = i;
				while (i < 4) this._playerWindows[i++].remove();
				this._isPlayer = isPlayer;
			}.bind(this));
			selfRef.onDisconnect().remove();
			selfRef.update({name: 'くらむぼん', charaName: $gamePlayer.characterName(), charaIndex: $gamePlayer.characterIndex()});
		}

		deck() {
			this._tableState = {
				revolution: false,
				elevenBack: false,
				lockSuit: null,
				sequence: false,
				tableCards: [],
			};
			this._startButton.visible = false;
			var deck = Card.shuffle(Card.deck());
			var cards = [];
			for (var i = 0; i < this._playerCount; i++) {
				cards.push(Card.deal(deck, 13));
				cards[i].sort(this.comparer.bind(this));
			}
			this._deckRef.set(cards);
		}

		clear() {
			this._tableState = {
				revolution: false,
				elevenBack: false,
				lockSuit: null,
				sequence: false,
				tableCards: [],
			};
		}

		flush() {
			this._handWindow.setEasing('easeOutQuad');
			this._tableState.tableCards.forEach(function(cards) {
				cards.forEach(function(card) {
					var sprite = this._cardSprites[card];
					var offset = Math.randomInt(101) - 50;
					sprite.move(-200, sprite.y + offset, 30);
				}, this);
			}, this);
			if (this._tableState.elevenBack) {
				this._tableState.elevenBack = false;
				this._handWindow.sortCards(this.comparer.bind(this));
			}
			this._tableState.lockSuit = null;
			this._tableState.sequence = false;
			this._tableState.tableCards = [];
		}

		putCards(putCards) {
			if (putCards.length) {
				this._tableState.tableCards.push(putCards);
				var offsetX = 300 + Math.randomInt(30);
				var offsetY = 150 + Math.randomInt(30);
				this._handWindow.setEasing('easeOutQuad');
				for (var i = 0; i < putCards.length; i++) {
					offsetX += Math.randomInt(15) - 7;
					offsetY += Math.randomInt(15) - 7;
					var sprite = this._cardSprites[putCards[i]];
					sprite.visible = true;
					sprite.move(offsetX + i * 40, offsetY, 15);
					this._cardSprites.addChild(sprite);
				}
				this.afterPut();
			} else {
				this.flush();
			}
		}

		onTurnEnd() {
			this._handWindow.activate();
			if (this._turnIndex !== this._myIndex) return;
			var putCards = this._handWindow.putCards();
			var canPut = this.canPut(putCards);
			this._handWindow.onTurnEnd(canPut);
			for (var key in putCards) {
				if (putCards[key].hasOwnProperty('toString')) delete putCards[key].toString;
			}
			if (canPut) this._cardRef.push(putCards.length === 0 ? {length: 0} : putCards);
		}

		canPut(putCards) {
			// パス
			if (putCards.length === 0) return true;
			// 場札が無い時は手札の整合性をチェック
			var tableCards = this._tableState.tableCards;
			if (tableCards.length === 0) {
				switch (putCards.length) {
					case 1:
						return true;
					case 2:
						return this.cardSame(putCards);
					default:
						var same = this.cardSame(putCards);
						if (same) return true;
						var seq = this.cardSeq(putCards);
						if (seq) this._tableState.sequence = true;
						return seq;
				}
			}
			var lastCards = tableCards[tableCards.length - 1];
			// 場札と手札の枚数は同じ
			if (putCards.length !== lastCards.length) return false;
			// スペ３
			if (putCards.length === 1) {
				var sp3 = putCards[0].suit === 'spade' && putCards[0].rank === 3;
				if (sp3 && lastCards[0].suit === 'joker') return true;
			}
			// しばり
			if (this._tableState.lockSuit) {
				for (var i = 0; i < putCards.length; i++) {
					if (!this._tableState.lockSuit.contains(putCards[i].suit)) return false;
				}
			}
			// 場札より大きな数字で、かつ場札と同じパターンであるか調べる
			var putRank = this.cardRank(putCards[0]);
			var lastRank = this.cardRank(lastCards[0]);
			// 場札が階段の時は、手札も階段
			if (this._tableState.sequence) {
				if (!this.cardSeq(putCards)) return false;
				// 直前で革命を起こしてると左端が最小値で無くなるので調整
				for (var i = 1; i < lastCards.length; i++) {
					var iRank = this.cardRank(lastCards[i]);
					if (lastRank > iRank) lastRank = iRank;
					else break;
				}
				// A,2,Jokerなどのパターンの時はJokerを下のランクに
				if (putRank === -putCards.length + 15) putRank -= 2;
				else if (putRank === -putCards.length + 14) putRank--;
			} else if (putCards.length >= 2) {
				if (!this.cardSame(putCards)) return false;
			}
			return putRank > lastRank;
		}

		afterPut() {
			var tableCards = this._tableState.tableCards;
			var lastCards = tableCards[tableCards.length - 1];
			var last2Cards = tableCards[tableCards.length - 2];
			// 革命
			if (lastCards.length >= 4) {
				this._tableState.revolution = !this._tableState.revolution;
			}
			if (last2Cards) {
				// しばり
				lock:
				if (!this._tableState.lockSuit) {
					var lockSuit = ['joker'];
					if (this._tableState.sequence) {
						if (lastCards[0].suit === last2Cards[0].suit) {
							lockSuit.push(lastCards[0].suit);
							this._tableState.lockSuit = lockSuit;
						}
						break lock;
					}
					for (var i = 0; i < lastCards.length; i++) {
						var joker = lastCards[i].suit === 'joker';
						if (joker || lastCards[i].suit !== last2Cards[i].suit) break lock;
						lockSuit.push(lastCards[i].suit);
					}
					this._tableState.lockSuit = lockSuit;
				}
				// スペ３
				var sp3 = lastCards[0].suit === 'spade' && lastCards[0].rank === 3;
				if (sp3 && last2Cards[0].suit === 'joker' && lastCards.length === 1) {
					this._tableState.lockSuit = null;
				}
			}
			if (!this._tableState.sequence) {
				var rank = lastCards[0].rank;
				// 八切り
				if (rank === 8) this.flush();
				// Ｊバック
				else if (rank === 11) this._tableState.elevenBack = true;
			}
			this._handWindow.sortCards(this.comparer.bind(this));
		}

		comparer(a, b) {
			var ar = this.cardRank(a) << 2;
			var br = this.cardRank(b) << 2;
			ar += Scene_CareerPoker.suitPriority[a.suit];
			br += Scene_CareerPoker.suitPriority[b.suit];
			if (a.suit === 'joker') ar = a.rank === 1 ? 52 : 53;
			if (b.suit === 'joker') br = b.rank === 1 ? 52 : 53;
			return ar - br;
		}

		cardRank(card) {
			if (card.suit === 'joker') return 13;
			if (this._tableState.revolution ^ this._tableState.elevenBack) {
				return 12 - (card.rank + 10) % 13;
			} else {
				return (card.rank + 10) % 13;
			}
		}

		cardSame(putCards) {
			return putCards.every(function(card) {
				return putCards[0].rank === card.rank || card.suit === 'joker';
			});
		}

		cardSeq(putCards) {
			var jokerCount = 0;
			for (var i = 2; i > 0; i--) {
				if (putCards[putCards.length - i].suit === 'joker') {
					jokerCount = i;
					break;
				}
			}
			var rank = this.cardRank(putCards[0]);
			for (var i = 1; i < putCards.length; i++) {
				rank++;
				var exist = putCards.some(function(card) {
					return this.cardRank(card) === rank;
				}, this);
				if (!exist && !jokerCount--) return false;
			}
			return putCards.every(function(card) {
				return putCards[0].suit === card.suit || card.suit === 'joker';
			});
		}
	}

	Scene_CareerPoker.suitPriority = {club: 0, diamond: 1, spade: 2, heart: 3};
})();