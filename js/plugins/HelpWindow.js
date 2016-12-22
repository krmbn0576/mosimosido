//=============================================================================
// HelpWindow.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc いつでもヘルプを表示/非表示します。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

(function() {
	'use strict';
	var visible = true;
	var text = '[Z, Enter]:調べる/決定\n[X]:ジャンプ/キャンセル\n[L]:チャットログを表示\n[Shift]:ダッシュ\n[Space]:チャットする\n[H]:ヘルプを表示/非表示\n[O]:オプションを開く';

	hook(Scene_Map, 'createAllWindows', function() {
		var origin = arguments[arguments.length - 1];
		origin.apply(this, arguments);
		this.createHelpWindow();
	});

	Scene_Map.prototype.createHelpWindow = function() {
		var cx = Graphics.boxWidth / 2;
		var cy = Graphics.boxHeight / 2;
		this._helpWindow = new Window_Base(cx + 40, 0, cx - 40, cy - 20);
		this._helpWindow.drawTextEx(text, 4, 0);
		this._helpWindow.visible = visible;
		this.addWindow(this._helpWindow);
	};

	Scene_Map.prototype.switchHelpWindow = function() {
		this._helpWindow.visible = visible = !visible;
	};
})();