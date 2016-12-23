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
			this._handWindow.setPutCardsHandler(this.putCards.bind(this));
			this.addWindow(this._handWindow);

			var bitmap = ImageManager.loadBitmap('img/trump/btn_', 'green', 0, true);
			bitmap.drawTextAsync('始める', 0, 0, 200, 50, 'center');
			this._startButton = new Sprite_Button();
			this._startButton.bitmap = bitmap;
			this._startButton.move(314, 260);
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
			this._playing = false;
			this._turnIndex = 0;
			this._putIndex = null;
			this._myIndex = null;

			this._roomRef = firebase.database().ref('rooms').child('0');
			this._usersRef = this._roomRef.child('users');
			this._selfRef = this._usersRef.push();
			this._cardRef = this._roomRef.child('card');
			this._deckRef = this._roomRef.child('deck');
			this._chatRef = this._roomRef.child('chat');
			this._connectedRef = firebase.database().ref('.info/connected');

			this._connectedRef.on('value', this.onConnected, this);
			this._deckRef.on('value', this.onDeck, this);
			this._cardRef.on('child_added', this.onPutCards, this);

			this._chatRef.on('child_added', function(data) {
				this._chatLogWindow.pushLog(data.val());
			}, this);
			this._chatLogWindow.setChatHandler(function(message) {
				this._chatRef.push(message);
			}.bind(this));

			this._usersRef.on('value', function(data) {
				this._users = data.val();
				if (!this._playing) this.placePlayers();
				else {
					var i = 0;
					for (var k in this._users) {
						if (this._realPlayers && this._realPlayers.contains(this._users[k].id)) i++;
					}
					if (i < this._playerCount && SceneManager._stack.length) SceneManager.pop();
				}
			}, this);
			this._selfRef.onDisconnect().remove();
			var id = OnlineManager.user.uid;
			var n = $gameActors.actor(1).name();
			var cn = $gamePlayer.characterName();
			var ci = $gamePlayer.characterIndex();
			this._selfRef.set({id: id, name: n, charaName: cn, charaIndex: ci, other: ''});
		}

		placePlayers() {
			var i = 0;
			this._realPlayers = [];
			for (var key in this._users) {
				if (this._users[key].id === OnlineManager.user.uid) {
					this._myIndex = i;
					if (i === 0) {
						this._deckRef.onDisconnect().remove();
						this._cardRef.onDisconnect().remove();
						this._chatRef.onDisconnect().remove();
						if (!this._playing) this._startButton.visible = true;
					} else {
						this._deckRef.onDisconnect().cancel();
						this._cardRef.onDisconnect().cancel();
						this._chatRef.onDisconnect().cancel();
						this._startButton.visible = false;
					}
				}
				this._realPlayers[i] = this._users[key].id;
				this._playerWindows[i++].setup(this._users[key]);
				if (i === 4) break;
			}
			this._playerCount = i;
			while (i < 4) this._playerWindows[i++].remove();
		}

		onConnected(data) {
			if (data.val()) this._selfRef.onDisconnect().remove();
			else this.popScene();
		}

		terminate() {
			super.terminate();
			this._selfRef.onDisconnect().cancel();
			this._selfRef.remove();
			this._usersRef.off();
			this._cardRef.off();
			this._deckRef.off();
			this._chatRef.off();
			this._connectedRef.off('value', this.onConnected, this);
		}

		deck() {
			this._startButton.visible = false;
			var deck = Card.shuffle(Card.deck());
			var cards = [];
			for (var i = 0; i < this._playerCount; i++) {
				cards.push(Card.deal(deck, 13));
			}
			this._deckRef.set(cards);
		}

		onDeck(data) {
			var deckCards = data.val();
			if (deckCards) {
				this._playing = true;
				this._tableState = {
					revolution: false,
					elevenBack: false,
					lockSuit: null,
					sequence: false,
					tableCards: [],
				};
				if (this._myIndex !== null && this._myIndex < 4) {
					var cards = deckCards[this._myIndex];
					Card.rebirth(cards);
					cards.sort(this.comparer.bind(this));
					this._handWindow.setCards(cards);
				}
				this._restCards = [];
				for (var i = 0; i < this._playerCount; i++) {
					this._restCards.push(13);
				}
				this.refreshPlayers();
			}
		}

		refreshPlayers() {
			for (var i = 0; i < this._playerCount; i++) {
				var str = '残り' + this._restCards[i] + '枚';
				if (this._turnIndex === i) str += '　手番';
				this._playerWindows[i].player().other = str;
				this._playerWindows[i].refresh();
			}
			if (this._playerCount === 1) {
				if (this._restCards[0] === 0) this.clean();
			} else {
				var zero = this._restCards.filter(function(r) {return r === 0;});
				if (zero.length === this._playerCount - 1) {
					if (this._myIndex === 0) this.clean();
				}
			}
		}

		clean() {
			this.flush();
			this._playing = false;
			Card.deck().forEach(function(card) {
				this._cardSprites[card].selected = false;
			}, this);
			if (this._myIndex === 0) {
				this._deckRef.remove();
				this._cardRef.remove();
				this._startButton.visible = true;
			}
			this.placePlayers();
		}

		flush() {
			this._turnIndex = this._putIndex;
			this._putIndex = null;
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

		onPutCards(data) {
			var value = data.val();
			this._restCards[this._turnIndex] = value.rest;
			var putCards = value.cards;
			if (putCards) {
				Card.rebirth(putCards);
				this._putIndex = this._turnIndex;
				this._tableState.tableCards.push(putCards);
				var offsetX = 300 + Math.randomInt(30);
				var offsetY = 150 + Math.randomInt(30);
				this._handWindow.setEasing('easeOutQuad');
				for (var i = 0; i < putCards.length; i++) {
					offsetX += Math.randomInt(15) - 7;
					offsetY += Math.randomInt(15) - 7;
					var sprite = this._cardSprites[putCards[i]];
					sprite.move(offsetX + i * 40, offsetY, 15);
					this._cardSprites.addChild(sprite);
				}
				this.afterPut();
			}
			if (this._playerCount >= 2) {
				do {
					this._turnIndex++;
					if (this._turnIndex === this._playerCount) this._turnIndex = 0;
				} while (this._restCards[this._turnIndex] === 0);
			}
			if (!putCards && this._turnIndex === this._putIndex) this.flush();
			this.refreshPlayers();
		}

		putCards() {
			if (this._playing && this._turnIndex === this._myIndex) {
				var putCards = this._handWindow.putCards();
				var canPut = this.canPut(putCards);
				this._handWindow.onPutCards(canPut);
				if (canPut) {
					this._handWindow.select(0);
					var rest = this._restCards[this._myIndex];
					rest -= putCards.length;
					this._cardRef.push({rest: rest, cards: putCards});
				}
			}
		}

		canPut(putCards) {
			// 場札が無い時は手札の整合性をチェック
			var tableCards = this._tableState.tableCards;
			if (tableCards.length === 0) {
				switch (putCards.length) {
					case 0:
						return false;
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
			// 場札がある時はパスできる
			if (putCards.length === 0) return true;
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