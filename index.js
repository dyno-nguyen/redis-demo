const { generateCart, showMenu } = require('./feature');

(function main() {
	generateCart(0).then(() => {
		showMenu();
	});
})();
