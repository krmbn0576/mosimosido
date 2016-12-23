//=============================================================================
// DrawAsync.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc draw系のメソッドをロード後に実行します。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

(function() {
	'use strict';
	Bitmap.prototype.drawTextAsync = function(text, x, y, maxWidth, lineHeight, align) {
		this.addLoadListener(function() {
			this.drawText(text, x, y, maxWidth, lineHeight, align);
		}.bind(this));
	};

	Window_Base.prototype.drawFaceAsync = function(faceName, faceIndex, x, y, width, height) {
		ImageManager.loadFace(faceName).addLoadListener(function() {
			this.drawFace(faceName, faceIndex, x, y, width, height);
		}.bind(this));
	};

	Window_Base.prototype.drawCharacterAsync = function(characterName, characterIndex, x, y) {
		ImageManager.loadCharacter(characterName).addLoadListener(function() {
			this.drawCharacter(characterName, characterIndex, x, y);
		}.bind(this));
	};
})();