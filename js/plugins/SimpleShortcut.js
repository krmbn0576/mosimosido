//=============================================================================
// SimpleShortcut.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc ログや変数などのショートカットを定義します。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

var l = console.log.bind(console);

function s(id, value) {
	if (arguments.length >= 2) $gameSwitches.setValue(id, value);
	return $gameSwitches.value(id);
}

function v(id, value) {
	if (arguments.length >= 2) $gameVariables.setValue(id, value);
	return $gameVariables.value(id);
}

function hook(baseClass, target, addition) {
	if (baseClass.prototype[target]) baseClass = baseClass.prototype;
	else if (!baseClass[target]) throw new Error('フック先が無いんですけど！');
	var origin = baseClass[target];
	baseClass[target] = function() {
		arguments[arguments.length] = origin;
		arguments.length++;
		return addition.apply(this, arguments);
	};
}