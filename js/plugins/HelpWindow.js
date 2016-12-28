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
	var text = '[Z, Enter]:調べる/決定　[X]:ジャンプ/キャンセル\n[L]:チャットログ　[Shift]:ダッシュ　[Space]:発言する\n[H]:ヘルプ　[O]:オプション　※タップのみでもほぼ操作可';

	hook(Scene_Map, 'createAllWindows', function() {
		var origin = arguments[arguments.length - 1];
		origin.apply(this, arguments);
		this.createHelpWindow();
		this.createChatLogWindow();
	});

	Scene_Map.prototype.createHelpWindow = function() {
		this._helpWindow = new Window_Base(0, 0, Graphics.boxWidth, Graphics.boxHeight);
		this._helpWindow.height = this._helpWindow.fittingHeight(3);
		this._helpWindow.drawTextEx(text, 4, 0);
		this._helpWindow.visible = visible;
		this._helpWindow.update = function() {
			Window_Base.prototype.update.call(this);
			var w = SceneManager._scene._chatLogWindow;
			if ($gameMap.isEventRunning() && w.visible) {
				w.visible = false;
				w.deactivate();
			}
			if (!$gameMap.isEventRunning() && !w.visible) {
				w.visible = true;
				w.activate();
			}
			if (TouchInput.isTriggered() && Window_Selectable.prototype.isTouchedInsideFrame.call(this)) {
				SceneManager._scene.switchHelpWindow();
			}
		};
		this.addWindow(this._helpWindow);
	};

	Scene_Map.prototype.switchHelpWindow = function() {
		this._helpWindow.visible = visible = !visible;
	};

	Scene_Map.prototype.createChatLogWindow = function() {
		var y = this._helpWindow.height;
		var rect = new Rectangle(0, 550, Graphics.boxWidth, Graphics.boxHeight - 550);
		var exRect = new Rectangle(0, y, Graphics.boxWidth, 550 - y);
		this._chatLogWindow = new Window_Chat(rect, exRect);
		this._chatLogWindow.setChatHandler(function(message) {
			v(3, message);
			Game_Interpreter.prototype.pluginCommand('namePop', ['-1', '\\V[3]']);
			Game_Interpreter.prototype.pluginCommand('online', ['3', 'to', 'chat']);
			ChatLogManager.chat(3, $gamePlayer);
			v(2, 180);
		}.bind(this));
		this.addWindow(this._chatLogWindow);
	};

	hook(Scene_Map, 'isMapTouchOk', function() {
		var origin = arguments[arguments.length - 1];
		return origin.apply(this, arguments) && !this._chatLogWindow._isExpanded;
	});
})();