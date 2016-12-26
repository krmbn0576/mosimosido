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
			this.eightToRight();
			this.addChild(this._cardSprites);
			this._handWindow = new Window_Hand(this._cardSprites, 0, 330);
			this._handWindow.setPutCardsHandler(this.putCards.bind(this));
			this.addWindow(this._handWindow);
			this._startButton = this.createButton('green', '始める', 314, 260, 'deal');
			this._endButton = this.createButton('red', '退出する', 550, 260, 'popScene');
			SoundManager.loadSystemSound(4);

			var points = [0, 200, 50, 50, 466, 50, 516, 200];
			this._playerWindows = [];
			this._playerCount = 4;
			for (var i = 0; i < this._playerCount; i++) {
				this._playerWindows[i] = new Window_Player(points[i * 2], points[i * 2 + 1]);
				this.addWindow(this._playerWindows[i]);
			}

			var y = this._handWindow.y + this._handWindow.height;
			var rect = new Rectangle(0, y, 500, Graphics.boxHeight - y);
			var exRect = new Rectangle(0, 0, Graphics.boxWidth, y);
			this._chatLogWindow = new Window_Chat(rect, exRect);
			this._chatLogWindow.setWindowHandler(this._handWindow);
			this.addChild(this._chatLogWindow);

			this._gameEndWindow = new Window_GameEnd();
			this._gameEndWindow.close();
			this._gameEndWindow.setHandler('toTitle', this.popScene.bind(this));
			this._gameEndWindow.setHandler('cancel', function() {
				this._chatLogWindow.activate();
				this._handWindow.onChatCompact();
				this._gameEndWindow.close();
				this._gameEndWindow.deactivate();
			}.bind(this));
			this.addChild(this._gameEndWindow);
		}

		createButton(color, text, x, y, method) {
			var button = new Sprite_TextButton(color, text, x, y);
			button.setClickHandler(this[method].bind(this));
			button.visible = false;
			this.addChild(button);
			return button;
		}

		isReady() {
			return !!OnlineManager.user && super.isReady();
		}

		start() {
			this._playing = false;

			this._roomRef = firebase.database().ref('rooms').child('1');
			this._usersRef = this._roomRef.child('users');
			this._selfRef = this._usersRef.push();
			this._dealRef = this._roomRef.child('deal');
			this._cardRef = this._roomRef.child('card');
			this._chatRef = this._roomRef.child('chat');
			this._connectedRef = firebase.database().ref('.info/connected');

			this._dealRef.on('value', this.onDeal, this);
			this._cardRef.on('child_added', this.onPutCards, this);
			this._chatRef.on('child_added', function(data) {
				this._chatLogWindow.pushLog(data.val());
			}, this);
			this._chatLogWindow.setChatHandler(function(message) {
				this._chatRef.push(message);
			}.bind(this));
			this._connectedRef.on('value', this.onConnected, this);
			this._usersRef.on('value', this.onUsers, this);

			this._selfRef.onDisconnect().remove();
			var id = OnlineManager.user.uid;
			var n = $gameParty.name();
			var cn = $gamePlayer.characterName();
			var ci = $gamePlayer.characterIndex();
			this._selfRef.set({id: id, name: n, charaName: cn, charaIndex: ci, other: ''});
		}

		chatSystem(message) {
			this._chatLogWindow.pushLog('\\C[6]' + message + '\\C[0]');
		}

		showCards(cards) {
			return cards.toString().replace('Jo1', 'Jo').replace('Jo2', 'Jo');
		}

		update() {
			if (!this._gameEndWindow.isOpenAndActive()) {
				if (Input.isTriggered('ok') && this._startButton.visible) {
					this._startButton.callClickHandler();
					this._handWindow.updateInputData();
				}
				if (Input.isTriggered('escape') && this._endButton.visible) {
					this._endButton.callClickHandler();
				}
				if (Input.isTriggered('shift')) {
					this._chatLogWindow.deactivate();
					this._handWindow.onChatExpand();
					this._gameEndWindow.open();
					this._gameEndWindow.activate();
				}
			}
			super.update();
		}

		onUsers(data) {
			this._users = data.val();
			if (!this._users) {
				this._dealRef.remove();
				this._cardRef.remove();
				this._chatRef.remove();
			} else if (!this._playing) this.placePlayers();
		}

		placePlayers() {
			if (!this._users) return;
			var keys = Object.keys(this._users);
			for (var i = 0; i < this._playerCount; i++) {
				var user = this._users[keys[i]];
				if (!user) {
					this._playerWindows[i].remove();
					continue;
				}
				if (user.id === OnlineManager.user.uid) {
					if (i === 0) {
						this._dealRef.onDisconnect().remove();
						this._cardRef.onDisconnect().remove();
						this._chatRef.onDisconnect().remove();
						if (!this._playing) this._startButton.visible = true;
					} else {
						this._dealRef.onDisconnect().cancel();
						this._cardRef.onDisconnect().cancel();
						this._chatRef.onDisconnect().cancel();
						this._startButton.visible = false;
					}
				}
				this._playerWindows[i].setup(user);
			}
		}

		onConnected(data) {
			if (data.val()) this._selfRef.onDisconnect().remove();
			else this.popScene();
		}

		terminate() {
			super.terminate();
			if (this._myRef) {
				this._myRef.onDisconnect().cancel();
				this._myRef.remove();
				this._myRef = null;
			}
			this._dealRef.onDisconnect().cancel();
			this._cardRef.onDisconnect().cancel();
			this._chatRef.onDisconnect().cancel();
			this._selfRef.onDisconnect().cancel();
			this._selfRef.remove();
			this._usersRef.off();
			this._cardRef.off();
			this._dealRef.off();
			this._chatRef.off();
			this._connectedRef.off('value', this.onConnected, this);
		}

		deal() {
			this._startButton.visible = false;
			var deck = Card.shuffle(Card.deck());
			var gameInfo = [];
			var keys = Object.keys(this._users);
			for (var i = 0; i < keys.length && i < this._playerCount; i++) {
				gameInfo.push({user: this._users[keys[i]], cards: Card.deal(deck, 13)});
			}
			this._dealRef.set(gameInfo);
		}

		onDeal(data) {
			var value = data.val();
			if (value) {
				this._players = value.map(function(x) {return x.user});
				if (this._playing) {
					for (var i = 0; i < this._playerCount; i++) {
						var user = this._players[i];
						if (!user) {
							this._restCards[i] = -1;
							var next = next || i === this._turnIndex;
						}
					}
					if (next) this.nextTurn();
					this.refreshPlayers();
					return;
				}
				this._solo = value.length === 1;
				var dealCards = value.map(function(x) {return x.cards});
				this._endButton.visible = false;
				this._turnIndex = 0;
				this._passCount = 0;
				this._playing = true;
				this._tableState = {
					revolution: false,
					elevenBack: false,
					lockSuit: null,
					sequence: false,
					tableCards: [],
				};
				var playerIDs = this._players.map(function(x) {return x.id});
				this._myIndex = playerIDs.indexOf(OnlineManager.user.uid);
				if (this._myIndex >= 0) {
					var cards = dealCards[this._myIndex];
					Card.rebirth(cards);
					cards.sort(this.comparer.bind(this));
					this._handWindow.setCards(cards);
					this._myRef = this._dealRef.child(this._myIndex);
					this._myRef.onDisconnect().remove();
				} else {
					this.chatSystem('ただいま対戦中です。');
				}
				this._restCards = [];
				for (var i = 0; i < this._playerCount; i++) {
					this._restCards.push(i < dealCards.length ? 13 : -1);
				}
				this.refreshPlayers();
			} else this.clean();
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

		refreshPlayers() {
			for (var i = 0; i < this._playerCount; i++) {
				var player = this._players[i];
				if (player) {
					var str = '残り' + this._restCards[i] + '枚';
					if (this._turnIndex === i) str += '　手番';
					player.other = str;
					this._playerWindows[i].setup(player);
				} else this._playerWindows[i].remove();
			}
			if (this._solo) {
				if (this._restCards[0] === 0) this.clean();
				return;
			}
			var zero = this._restCards.filter(function(r) {return r <= 0;});
			if (zero.length === this._playerCount - 1) {
				this.clean();
			}
		}

		clean() {
			var tableCards = this._tableState && this._tableState.tableCards;
			var lastCards = tableCards && tableCards[tableCards.length - 1];
			if (lastCards) {
				var result;
				if (this._restCards[this._myIndex] === 0) {
					result = '勝利！';
					BattleManager.playVictoryMe();
				} else if (this._restCards[this._myIndex] > 0) {
					result = '敗北…';
					BattleManager.playDefeatMe();
				} else {
					result = '決着！';
				}
				this.chatSystem('%1(決まり手：%2)'.format(result, this.showCards(lastCards)));
			}
			if (this._myIndex === 0) {
				this._dealRef.remove();
				this._cardRef.remove();
				this._startButton.visible = true;
			}
			if (this._myRef) {
				this._myRef.onDisconnect().cancel();
				this._myRef = null;
			}
			this._endButton.visible = true;
			this._playing = false;
			this._handWindow.setCards([]);
			this._handWindow.deselect();
			this._cardSprites.reset();
			this.eightToRight();
			this.placePlayers();
		}

		eightToRight() {
			['spade', 'diamond', 'club', 'heart'].forEach(function(suit) {
				var theta = Math.random() - 0.5;
				var x = (Graphics.boxWidth - 100) / 2 + Math.cos(theta) * 600;
				var y = (Graphics.boxHeight - 150) / 2 + Math.sin(theta) * 600;
				this._cardSprites[new Card(suit, 8)].move(x, y, 1);
			}, this);
		}

		onPutCards(data) {
			var value = data.val();
			this._turnIndex = value.turn;
			this._restCards[this._turnIndex] = value.rest;
			var putCards = value.cards;
			if (putCards) {
				Card.rebirth(putCards);
				this._passCount = 0;
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
			} else if (this._solo) this.flush();
			this.nextTurn();
			this.refreshPlayers();
		}

		nextTurn() {
			if (this._solo) {
				if (this._turnIndex === -1) {
					this._turnIndex++;
					this.flush();
				}
				return;
			}
			var startIndex = this._turnIndex;
			do {
				this._turnIndex++;
				this._passCount++;
				if (this._turnIndex === this._playerCount) this._turnIndex = 0;
				if (startIndex === this._turnIndex) break;
			} while (this._restCards[this._turnIndex] <= 0);
			if (this._passCount >= this._playerCount) this.flush();
			if (this._turnIndex === this._myIndex) SoundManager.playEquip();
		}

		putCards() {
			if (this._turnIndex === this._myIndex) {
				var putCards = this._handWindow.putCards();
				var canPut = this.canPut(putCards);
				this._handWindow.onPutCards(canPut);
				if (canPut) {
					var count = putCards.length;
					var rest = this._restCards[this._myIndex];
					if (count > 0) this._handWindow.select(0);
					rest -= count;
					this._cardRef.push({rest: rest, turn: this._turnIndex, cards: putCards});
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
						return this.cardSame(putCards) || this.cardSeq(putCards);
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
				this.chatSystem('革命！');
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
							this.chatSystem(Card.suitToString[lastCards[0].suit] + 'しばり！');
						}
						break lock;
					}
					for (var i = 0; i < lastCards.length; i++) {
						var joker = lastCards[i].suit === 'joker';
						if (joker || lastCards[i].suit !== last2Cards[i].suit) break lock;
						lockSuit.push(lastCards[i].suit);
					}
					this._tableState.lockSuit = lockSuit;
					var list = lockSuit.map(function(suit) {return Card.suitToString[suit]});
					this.chatSystem(list.join('').replace(/Jo/g, '') + 'しばり！');
				}
				// スペ３
				var sp3 = lastCards[0].suit === 'spade' && lastCards[0].rank === 3;
				if (sp3 && last2Cards[0].suit === 'joker' && lastCards.length === 1) {
					this._tableState.lockSuit = null;
					this.chatSystem('スペ３返し！');
				}
			} else {
				// 階段
				this._tableState.sequence = !this.cardSame(lastCards) && this.cardSeq(lastCards);
			}
			if (!this._tableState.sequence) {
				var rank = lastCards[0].rank;
				if (rank === 8) {
					// 八切り
					this._passCount = this._playerCount;
					this._turnIndex--;
					this.chatSystem('８切り！(%1)'.format(this.showCards(lastCards)));
				} else if (rank === 11) {
					// Ｊバック
					this._tableState.elevenBack = true;
					this.chatSystem('Ｊバック！');
				}
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