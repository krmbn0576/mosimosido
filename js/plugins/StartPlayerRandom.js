//=============================================================================
// StartPlayerRandom.js
// PUBLIC DOMAIN
//=============================================================================

/*:
 * @plugindesc スタート時のプレイヤーをランダムに選びます。
 * @author くらむぼん
 *
 * @help
 * 自分用のプラグインのため特に解説や宣伝はしませんが、
 * あなたの作品で利用して頂く分には一向に構いません。
 * ご自由にお使いください。
 */

(function() {
	'use strict';
	hook(DataManager, 'setupNewGame', function() {
		var origin = arguments[arguments.length - 1];
		origin.apply(this, arguments);
		$gameActors.actor(1).setCharacterImage('2000actor' + (Math.randomInt(4) + 1), Math.randomInt(8));
	});
})();