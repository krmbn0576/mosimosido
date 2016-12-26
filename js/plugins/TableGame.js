//=============================================================================
// TableGame.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc オンライン対戦を含むテーブルゲーム用の基本プラグインです。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

var Sprite_TextButton, Window_Chat, Window_Player;

(function() {
	'use strict';
	Sprite_TextButton = class extends Sprite_Button {
		initialize(color, text, x, y) {
			var bitmap = ImageManager.loadBitmap('img/trump/btn_', color, 0, true);
			bitmap.drawTextAsync(text, 0, 0, 200, 50, 'center');
			super.initialize();
			this.bitmap = bitmap;
			this.move(x, y);
		}
	}

	Window_Chat = class extends Window_Base {
		initialize(rect, exRect) {
			super.initialize(rect.x, rect.y, exRect.width, exRect.height);
			this.width = rect.width;
			this.height = rect.height;
			this._rect = rect;
			this._exRect = exRect;
			this._log = [];
			this._logMax = (exRect.height - this.padding * 2) / this.lineHeight();
			this._isExpanded = false;
			this._keepExpand = false;
			this._s = 5;
			this._v = 3;
			this.v(0);
		}

		s(value) {
			if (arguments.length >= 1) return s(this._s, value);
			else return s(this._s);
		}

		v(value) {
			if (arguments.length >= 1) return v(this._v, value);
			else return v(this._v);
		}

		pushLog(message) {
			if (message) {
				this._log.push(message.toString());
				if (this._log.length > this._logMax) this._log.shift();
				this.refresh();
			}
		}

		lastLog() {
			return this._log[this._log.length - 1];
		}

		allLog() {
			return this._log.join('\n');
		}

		log() {
			return this._isExpanded ? this.allLog() : this.lastLog();
		}

		openChat() {
			this.s(false);
			var str = 'x=%1;y=%2;v=%3;max=28;if_s=%4;btn_x=384;btn_y=0;';
			var args = [str.format(this._rect.x + 20, this._rect.y + 20, this._v, this._s)];
			$gameMap._interpreter.pluginCommand('InputForm', args);
			this.expand();
		}

		expand() {
			if (!this._isExpanded) {
				this._isExpanded = true;
				this.x = this._exRect.x;
				this.y = this._exRect.y;
				this.width = this._exRect.width;
				this.height = this._exRect.height;
				if (this._onExpand) this._onExpand();
				this.refresh();
			}
		}

		compact() {
			if (this._isExpanded) {
				this._isExpanded = false;
				this.x = this._rect.x;
				this.y = this._rect.y;
				this.width = this._rect.width;
				this.height = this._rect.height;
				if (this._onCompact) this._onCompact();
				this.refresh();
			}
		}

		refresh() {
			this.contents.clear();
			this.drawTextEx(this.log(), 4, 0);
		}

		update() {
			super.update();
			if (!this.active) return;
			else if (Input.isTriggered('chat')) this.openChat();
			else if (Input.isTriggered('log')) {
				if (!this._isExpanded) {
					this._keepExpand = true;
					this.expand();
				} else {
					this._keepExpand = false;
					this.compact();
				}
			} else if (TouchInput.isTriggered()) {
				if (this.isTouchedInsideFrame()) {
					if (!this._isExpanded) {
						this._keepExpand = true;
						this.openChat();
					} else {
						this._keepExpand = false;
						this.s(true);
						this.compact();
					}
				}
			} else if (this._isExpanded && !Input.form_mode) {
				var message = this.v();
				if (message) {
					message = $gameParty.name() + ':' + message;
					if (this._onChat) this._onChat(message);
					else this.pushLog(message);
					this.v(0);
				}
				if (!this._keepExpand) this.compact();
			}
		}

		deactivate() {
			super.deactivate();
			this._keepExpand = false;
			this.s(true);
			this.compact();
		}

		isTouchedInsideFrame() {
			return Window_Selectable.prototype.isTouchedInsideFrame.call(this);
		}

		setChatHandler(onChat) {
			this._onChat = onChat;
		}

		setWindowHandler(window) {
			this._onExpand = window.onChatExpand.bind(window);
			this._onCompact = window.onChatCompact.bind(window);
		}
	}

	Window_Player = class extends Window_Base {
		initialize(x, y) {
			var height = this.fittingHeight(2);
			super.initialize(x, y, 300, height);
			this.openness = 0;
		}

		setup(player) {
			this._player = player;
			this.refresh();
			this.open();
		}

		remove() {
			this._player = null;
			this.contents.clear();
			this.close();
		}

		refresh() {
			var p = this._player;
			var str = p.name + '\n' + p.other;
			this.contents.clear();
			this.drawTextEx(str, 4, 0);
			this.drawCharacterAsync(p.charaName, p.charaIndex, 32 + 200, 64);
		}
	}
})();