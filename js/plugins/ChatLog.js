//=============================================================================
// ChatLog.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc チャットログを保持し、発言を動画風に流します。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

var ChatLogManager = {
	_pictureId: 80,
	_log: [],
	pictureId: function() {
		return this._pictureId === 100 ? this._pictureId = 81 : ++this._pictureId;
	},
	push: function(message) {
		this._log.push(message);
		if (this._log.length > 16) this._log.shift();
	},
	log: function() {
		return '[チャットログ]\n' + this._log.join('\n');
	},
	chat: function(chatId, event) {
		var chat = $gameVariables.value(chatId);
		if (chat && (chat !== event._prevChat || !event._prevChat)) {
			var y = Math.randomInt(550);
			var pictureId = this.pictureId();
			Game_Interpreter.prototype.pluginCommand('D_Text', [chat]);
			Game_Interpreter.prototype.pluginCommand('easing', ['linear']);
			$gameScreen.showPicture(pictureId, '', 0, 800, y, 100, 100, 255, 0);
			$gameScreen.movePicture(pictureId, 0, -1400, y, 100, 100, 255, 0, 600);
			this.push(chat);
		}
		event._prevChat = chat;
	},
};