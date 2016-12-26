//=============================================================================
// TrumpCard.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc テーブルゲーム用のトランプに関する基本プラグインです。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

var Card, Sprite_Card, Sprite_Cardset, Window_Hand;

(function() {
	'use strict';
	Card = class {
		constructor(suit, rank) {
			if (!Card.suitToString[suit]) throw new Error('このスートは存在しません。');
			this.suit = suit;
			this.rank = rank;
		}

		toString() {
			return Card.suitToString[this.suit] + (Card.rankToString[this.rank] || this.rank);
		}

		static deck() {
			var deck = [];
			['spade', 'diamond', 'club', 'heart'].forEach(function(suit) {
				for (var i = 1; i <= 13; i++) {
					deck.push(new Card(suit, i));
				}
			});
			deck.push(new Card('joker', 1));
			deck.push(new Card('joker', 2));
			return deck;
		}

		static shuffle(array) {
			var i = array.length;
			while (i) {
				var j = Math.floor(Math.random() * i);
				var t = array[--i];
				array[i] = array[j];
				array[j] = t;
			}
			return array;
		}

		static draw(array) {
			return array.shift();
		}

		static deal(subject, count, object) {
			if (subject.length < count) throw new Error('そんなに引けません。');
			object = object || [];
			while (--count >= 0) {
				object.push(this.draw(subject));
			}
			return object;
		}

		static rebirth(array) {
			for (var i = 0; i < array.length; i++) {
				array[i] = new Card(array[i].suit, array[i].rank);
			}
		}
	}

	Card.suitToString = {
		spade: '♠',
		diamond: '♦',
		club: '♣',
		heart: '♥',
		joker: 'Jo',
	};

	Card.rankToString = {
		11: 'J',
		12: 'Q',
		13: 'K',	
	};

	Sprite_Card = class extends Sprite {
		initialize(card) {
			var filename = card.suit[0] + card.rank.padZero(2);
			var bitmap = ImageManager.loadBitmap('img/trump/', filename, 0, true);
			super.initialize(bitmap);
			this.scale.set(0.5, 0.5);
			this.selected = false;
			this._picture = new Game_Picture();
		}

		update() {
			super.update();
			this._picture.update();
			if (this.visible) {
				this.x = Math.round(this._picture.x());
				this.y = Math.round(this._picture.y());
			}
		}

		move(x, y, d) {
			this._picture.move(0, x, y, 0.5, 0.5, 255, 0, d);
		}
	}

	Sprite_Cardset = class extends Sprite {
		initialize() {
			super.initialize();
			this._deck = Card.deck();
			this._deck.forEach(function(card) {
				this[card] = new Sprite_Card(card);
				this.addChild(this[card]);
			}, this);
			this.reset();
		}

		reset() {
			this._deck.forEach(function(card) {
				var theta = 2 * Math.PI * Math.random();
				var x = (Graphics.boxWidth - 100) / 2 + Math.cos(theta) * 600;
				var y = (Graphics.boxHeight - 150) / 2 + Math.sin(theta) * 600;
				this[card].move(x, y, 1);
				this[card].selected = false;
			}, this);
		}
	}

	Window_Hand = class extends Window_Selectable {
		initialize(cardset, x, y, width, height) {
			this._cardSprites = cardset;
			this._cards = [];
			width = width || this.windowWidth();
			height = height || this.windowHeight();
			super.initialize(x, y, width, height);
			this.refresh();
			this.select(0);
			this.activate();
			this._putCardsButton = new Sprite_TextButton('orange', '出す(パス)', 550, height + 20);
			this.addChild(this._putCardsButton);
		}

		setCards(cards) {
			this._cards = cards;
			this.setEasing('easeOutQuad');
			this.refresh();
		}

		cardSprite(index) {
			return this._cardSprites[this._cards[index]];
		}

		cardMove(sprite, x, y, d) {
			sprite.move(this.x + this.padding + x, this.y + this.padding + y, d);
		}

		setEasing(easing) {
			$gameTemp._easingX = $gameTemp._easingY = easing;
		}

		sortCards(comparer) {
			this._cards.sort(comparer);
			this.setCards(this._cards);
		}

		setPutCardsHandler(onPutCards) {
			this.setHandler('cancel', onPutCards);
			this._putCardsButton.setClickHandler(onPutCards);
		}

		windowWidth() {
			return Graphics.boxWidth;
		}

		windowHeight() {
			return this.itemHeight() + 50;
		}

		itemWidth() {
			return 100;
		}

		itemHeight() {
			return 170;
		}

		maxCols() {
			return this._cards.length;
		}

		maxRows() {
			return 1;
		}

		maxItems() {
			return this._cards.length;
		}

		spacing() {
			return Math.min(0, ((this.width - this.padding * 2) - this.maxCols() * this.itemWidth()) / (this.maxCols() - 1));
		}

		drawItem(index) {
			var sprite = this.cardSprite(index);
			var rect = this.itemRect(index);
			this._cardSprites.addChild(sprite);
			this.cardMove(sprite, rect.x, sprite.selected ? 0 : 20, 10);
		}

		isOkEnabled() {
			return this._cards.length;
		}

		isCurrentItemEnabled() {
			return this.index() >= 0;
		}

		callOkHandler() {
			var sprite = this.cardSprite(this.index());
			var rect = this.itemRect(this.index());
			sprite.selected = !sprite.selected;
			this.setEasing('easeOutElastic');
			this.cardMove(sprite, rect.x, sprite.selected ? 0 : 20, 10);
			this.activate();
		}

		onPutCards(canPut) {
			if (canPut) {
				SoundManager.playOk();
				var restCards = this._cards.filter(function(card) {
					return !this._cardSprites[card].selected;
				}, this);
				this.setCards(restCards);
			} else {
				this.playBuzzerSound();
			}
		}

		putCards() {
			return this._cards.filter(function(card) {
				return this._cardSprites[card].selected;
			}, this);
		}

		onTouch(triggered) {
			var lastIndex = this.index();
			var x = this.canvasToLocalX(TouchInput.x);
			var y = this.canvasToLocalY(TouchInput.y);
			var hitIndex = this.hitTest(x, y);
			if (hitIndex >= 0) {
				if (triggered && this.isTouchOkEnabled()) {
					this.select(hitIndex);
					this.processOk();
				}
			}
		}

		hitTest(x, y) {
			if (this.isContentsArea(x, y)) {
				var cx = x - this.padding;
				var cy = y - this.padding;
				var topIndex = this.topIndex();
				for (var i = this.maxPageItems() - 1; i >= 0; i--) {
					var index = topIndex + i;
					if (index < this.maxItems()) {
						var rect = this.itemRect(index);
						var right = rect.x + rect.width;
						var bottom = rect.y + rect.height;
						if (cx >= rect.x && cy >= rect.y && cx < right && cy < bottom) {
							return index;
						}
					}
				}
			}
			return -1;
		}

		processCancel() {
			this.updateInputData();
			this.callCancelHandler();
		}

		playOkSound() {
			SoundManager.playCancel();
		}

		onChatExpand() {
			this.deactivate();
			this._putCardsButton.visible = false;
		}

		onChatCompact() {
			this.activate();
			this._putCardsButton.visible = true;
		}
	}
})();