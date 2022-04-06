const redisClient = require('./db');
const { faker } = require('@faker-js/faker');
const readline = require('readline');
const { MENUS } = require('./constant');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false,
});

module.exports.generateCart = async (quantity = 1) => {
	const promises = [];

	for (let i = 0; i < quantity; ++i) {
		const cookieId = faker.datatype.uuid().split('-')[0];
		const isPaid = Math.random() > 0.5 ? 0 : 1;

		// Tạo ngẫu nhiên mảng sản phẩm
		const products = [];
		const numOfProduct = ~~(Math.random() * 10) + 3;
		for (let j = 0; j < numOfProduct; ++j) {
			const name = faker.commerce.product();
			const price = faker.commerce.price(100, 10_000);
			const amount = ~~(Math.random() * 10) + 1;
			const photo = faker.image.imageUrl();
			products.push({ name, price, quantity: amount, photo });
		}

		// Thêm các sản phẩm vào giỏ hàng người dùng
		promises.push(
			redisClient.set(`carts:${cookieId}:products`, JSON.stringify(products)),
		);
		// Thêm trạng thái thanh toán
		products.push(redisClient.set(`carts:${cookieId}:isPaid`, isPaid));
	}

	await Promise.all(promises);
};

module.exports.showMenu = async () => {
	MENUS.forEach((item) => {
		console.log(`${item.option} - ${item.label}`);
	});

	const option = await question('Nhập lựa chọn: ');
	await runFeature(Number(option));
	this.showMenu();
};

function question(question) {
	return new Promise((resolve, reject) => {
		rl.question(question, (answer) => {
			resolve(answer);
		});
	});
}

async function exit() {
	await redisClient.disconnect();
	console.log('GOOD BYE :">');
	process.exit(0);
}

async function findUnpaidOrder() {
	// Lấy tất cả keys có của giỏ hàng có trạng thái thanh toán
	const keys = await redisClient.keys('carts:*:isPaid');
	const promises = [];

	keys.forEach((key) => {
		promises.push(
			// Query với mỗi key trên và kiểm tra nếu value = 0 thì chưa thanh toán
			redisClient.get(key).then((isPaid) => {
				if (Number(isPaid) === 0) {
					console.log(key);
				}
			}),
		);
	});

	await Promise.all(promises);
}

async function findOrderGreaterThanFive() {
	// Lấy tất cả key giỏ hàng chứa sản phẩm
	const keys = await redisClient.keys('carts:*:products');
	const promises = [];

	keys.forEach((key) => {
		promises.push(
			// Với mỗi key, lấy value của key đó
			redisClient.get(key).then((productStr) => {
				// Chuyển value từ String về Object
				const products = JSON.parse(productStr);
				// Nếu số lượng sản phầm lớn hơn 5 thì in ra màn hình
				if (products.length > 5) {
					console.log(key);
				}
			}),
		);
	});

	await Promise.all(promises);
}

async function findFrequencyProductX() {
	const productName = await question('Nhập tên sản phẩm X: ');
	let count = 0;
	const promises = [];

	const keys = await redisClient.keys('carts:*:products');

	keys.forEach((key) => {
		promises.push(
			redisClient.get(key).then((productStr) => {
				const products = JSON.parse(productStr);
				if (products && products.length) {
					// Nếu tên sản phẩm X xuất hiện trong giỏ hàng thì tăng biến đếm
					products.forEach((product) => {
						if (product.name === productName) ++count;
					});
				}
			}),
		);
	});

	await Promise.all(promises);
	console.log(`Sản phẩm "${productName}" xuất hiện "${count}" lần.`);
}

async function calculateOrderTotalPrice() {
	const cookieId = await question('Nhập id người dùng: ');
	let total = 0;

	// Lấy giỏ hàng của người dùng cò cookie ID
	const productStr = await redisClient.get(`carts:${cookieId}:products`);
	const products = JSON.parse(productStr);

	// Tính tổng tiền cho giỏ hàng
	total = products.reduce(
		(sum, product) => sum + Number(product.price) * Number(product.quantity),
		0,
	);

	console.log(
		`Tổng giá tiền đơn hàng của người dùng "${cookieId}" = ${total.toFixed(0)}`,
	);
}

async function listedUserOrder() {
	const cookieId = await question('Nhập id người dùng: ');

	const productStr = await redisClient.get(`carts:${cookieId}:products`);
	const products = JSON.parse(productStr);

	console.log(products);
}

async function deleteProductXInOrderY() {
	const productName = await question('Nhập tên sản phẩm X: ');
	const cookieId = await question('Nhập id người dùng: ');

	const productStr = await redisClient.get(`carts:${cookieId}:products`);

	const products = JSON.parse(productStr);
	if (products?.length) {
		const newProducts = products.filter(
			(product) => product.name !== productName,
		);

		// Cập nhật lại mảng sản phẩm cho giỏ hàng
		await redisClient.set(
			`carts:${cookieId}:products`,
			JSON.stringify(newProducts),
		);

		console.log('Xoá thành công !');
	} else {
		console.log('Không tìm thấy giỏ hàng phù hợp');
	}
}

async function increaseNumberOfXInY() {
	const productName = await question('Nhập tên sản phẩm X: ');
	const cookieId = await question('Nhập id người dùng: ');

	const productStr = await redisClient.get(`carts:${cookieId}:products`);
	const products = JSON.parse(productStr);

	if (products?.length) {
		const newProducts = products.map((product) => {
			if (product.name === productName) {
				return { ...product, quantity: Number(product.quantity) + 1 };
			}
			return product;
		});

		await redisClient.set(
			`carts:${cookieId}:products`,
			JSON.stringify(newProducts),
		);

		console.log('Cập nhật thành công !');
	} else {
		console.log('Không tìm thấy giỏ hàng phù hợp');
	}
}

async function deleteAllProductInCart() {
	const cookieId = await question('Nhập id người dùng: ');

	// Kìểm tra giỏ hàng tồn tại không ?
	const isExist = await redisClient.sendCommand([
		'EXISTS',
		`carts:${cookieId}:products`,
	]);

	if (isExist) {
		await redisClient.set(`carts:${cookieId}:products`, '[]');
		console.log('Xoá thành công !');
	} else {
		console.log('Không tìm thấy giỏ hàng phù hợp');
	}
}

async function findMaxTotalPrice() {
	const keys = await redisClient.keys('carts:*:products');
	let max = 0,
		keyMax = '';

	for (let key of keys) {
		let total = 0;

		const productStr = await redisClient.get(key);
		const products = JSON.parse(productStr);

		// Tính tổng tiền các giỏ hàng theo key
		total =
			products?.reduce(
				(sum, product) =>
					sum + Number(product.price) * Number(product.quantity),
				0,
			) || 0;

		// Cập nhật lại max
		if (total > max) {
			max = total;
			keyMax = key;
		}
	}

	console.log(`Đơn hàng có giá trị lớn nhất là ${keyMax} = ${max.toFixed(0)}`);
}

async function findMaxFreqOfProduct() {
	const productFreq = [];

	const promises = [];
	const keys = await redisClient.keys('carts:*:products');

	keys.forEach((key) => {
		promises.push(
			redisClient.get(key).then((productStr) => {
				const products = JSON.parse(productStr);
				if (products?.length) {
					products.forEach((product) => {
						// Tìm vị trí sản phẩm bên trong mảng tần suất
						const productFreqIndex = productFreq.findIndex(
							(item) => item.name === product.name,
						);

						if (productFreqIndex !== -1) {
							// Tăng số lần xuất hiện nếu tồn tại
							productFreq[productFreqIndex].quantity++;
						} else {
							// Thêm vào mảng tần suất
							productFreq.push({
								name: product.name,
								quantity: 1,
							});
						}
					});
				}
			}),
		);
	});

	await Promise.all(promises);

	let max = 1,
		maxName = '';
	productFreq.forEach((item) => {
		if (item.quantity >= max) {
			max = item.quantity;
			maxName = item.name;
		}
	});

	console.log(`Sản phẩm xuất hiện nhiều nhất là "${maxName}" = ${max}`);
}

async function runFeature(option = 0) {
	switch (option) {
		case 0:
			exit();
		case 1:
			await findUnpaidOrder();
			break;
		case 2:
			await findOrderGreaterThanFive();
			break;
		case 3:
			await findFrequencyProductX();
			break;
		case 4:
			await calculateOrderTotalPrice();
			break;
		case 5:
			await listedUserOrder();
			break;
		case 6:
			await deleteProductXInOrderY();
			break;
		case 7:
			await increaseNumberOfXInY();
			break;
		case 8:
			await deleteAllProductInCart();
			break;
		case 9:
			await findMaxTotalPrice();
			break;
		case 10:
			await findMaxFreqOfProduct();
			break;
		default:
			break;
	}
	console.log('-----------------------------------');
}
