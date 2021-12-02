figma.showUI(__html__);
figma.ui.resize(350, 320);

class Restaurant {
	constructor(
		readonly restaurantId: string,
		readonly name: string,
		readonly imageUrl: string, 
		readonly category: string,
		readonly address: string,
		readonly intersection: string,
		readonly cuisines: string[],
		readonly itemCategories: string[],
		readonly itemNames: string[],
		readonly itemDescriptions: string[],
	) {}
}

interface DataMapping { }

abstract class TextMapping implements DataMapping { 
	readonly abstract text: string
}

class SingleTextMapping extends TextMapping {
	constructor(
		readonly text: string
	) {
		super();
	}
}

class RandomTextMapping extends TextMapping {
	constructor(
		private readonly texts: string[]
	) { 
		super();
	}

	private randomQueue = new Array()
	public get text() {
		if (this.texts.length == 0) {
			return ""
		}
		
		if (this.randomQueue.length >= this.texts.length) {
			this.randomQueue.splice(0, 1)
		}

		var randomIndex = 0
		do {
			randomIndex = Math.floor(Math.random() * this.texts.length)
		} while (this.randomQueue.find(index => index == randomIndex) != undefined)
	
		this.randomQueue.push(randomIndex)
		return this.texts[randomIndex]
	}
}

class ImageMapping implements DataMapping {
	constructor(
		readonly imageUrl: string
	) {}
}

var refId = 0;
let cacheNodes = new Map<number, SceneNode>()

let restaurantMap = buildRestaurantMap()
let categoryMap = buildCategoryMap()

// ################################################################################################
// ################################################################################################

var fieldMatches = new Set();

figma.ui.onmessage = msg => {
	if (msg.type === 'get_restaurants') { publishRestaurants(); }
	if (msg.type === 'get_categories') { publishCategoryNames(); }
	if (msg.type === 'populate_restaurant_node') { populateComponent(msg.restaurantIds); }
	if (msg.type === 'apply_selected_category') { applySelectedCategory(msg.category); }
	else if (msg.type === 'on_image_data_response') { setImageFillForNode(msg.nodeId, msg.data); }
};

function publishRestaurants() {
	let restaurants = [];
	restaurantMap.forEach(element => {
		restaurants.push(element)
	})

	figma.ui.postMessage({ 
		type: 'restaurants_response', 
		restaurants: restaurants
	})
}

function publishCategoryNames() {
	let categories = []
	categoryMap.forEach((restaurants, category) => {
		categories.push(category)
	})
	
	figma.ui.postMessage({ 
		type: 'categories_response', 
		categories: categories
	})
}

function setImageFillForNode(nodeId: number, data: Uint8Array) {
	let node = cacheNodes.get(nodeId) as SceneNode;
	cacheNodes.delete(nodeId)

	let imageHash = figma.createImage(data).hash
	let fills = getNodeFills(node)
	let newFills: Array<Paint> = new Array()

	var imageSet = false
	for (let paint of fills) {
		if (paint.type == "IMAGE" && imageSet == false) {
			newFills.push(copyImagePaint(paint, imageHash))
			imageSet = true
		} else {
			newFills.push(paint)
		}
	}
	node["fills"] = newFills
}

function copyImagePaint(imagePaint: ImagePaint, imageHash: string): ImagePaint {
	return {
		type: "IMAGE",
  		scaleMode: imagePaint.scaleMode,
  		imageHash: imageHash,
  		imageTransform: imagePaint.imageTransform,
  		scalingFactor: imagePaint.scalingFactor,
  		rotation: imagePaint.rotation,
  		filters: imagePaint.filters,
  		visible: imagePaint.visible,
  		opacity: imagePaint.opacity,
  		blendMode: imagePaint.blendMode,
	}
}

function applySelectedCategory(category) {
	let restaurants = new Array()
	categoryMap.forEach((value, key) => {
		if (key == category || category == "") {
			restaurants.push(...value)
		}
	})
	populateComponent(restaurants)
}

function populateComponent(restaurantIds: Array<string>) {
	fieldMatches.clear();

	if (restaurantIds.length == 0) {
		return; // nothing to map
	}

	// TODO - setup action with mutiple ids (random, sequence, ...)
	var selectedRestaurantIndex = 0;
	var restaurantFieldMap = new Map<string, DataMapping>();

	let selectedNodes = figma.currentPage.selection
	if (selectedNodes.length == 0) {
		postErrorMessage("Please select a Component or a Group before applying restaurant data.")
		return
	}

	selectedNodes.forEach(selection => {
		navigateThroughNodes(selection, 
			() => {
				restaurantFieldMap = generateRandomRestaurantFieldMap(restaurantIds)
			}, node => {
				checkNodeMapping(node, restaurantFieldMap)
			}
		) 
	})

	if (fieldMatches.size == 0) {
		var keysText = ""
		restaurantFieldMap = generateRandomRestaurantFieldMap(restaurantIds)
		restaurantFieldMap.forEach((value, key) => {
			if (keysText.length > 0) { keysText += ", " }
			keysText += "<b>" + key + "</b>"
		});
		let message = "Failed to apply restaurant data. The root Component(s) or Group(s) should be rename <b>[restaurant-object]</b>, The fields inside should be renamed to the following options:<br><br>" + keysText
		postErrorMessage(message)
	}
}

function generateRandomRestaurantFieldMap(restaurantIds: string[]): Map<string, DataMapping> {
	let selectedRestaurantIndex = getRandomInt(restaurantIds.length)
	let restaurantId = restaurantIds[selectedRestaurantIndex];
	let selectedRestaurant = getRestaurantWithId(restaurantId);
	return restaurantToFieldMap(selectedRestaurant);
}

function checkNodeMapping(node: SceneNode, dataMap: Map<string, DataMapping>) {
	if (!dataMap.has(node.name)) {
		return;
	}
	let dataMapping = dataMap.get(node.name)
	if (dataMapping instanceof TextMapping && node.type === "TEXT") {
		updateTextNode(node as  TextNode, dataMapping as TextMapping);
	}
	else if (dataMapping instanceof ImageMapping && isNodeImage(node)) {
		updateImageNode(node, dataMapping as ImageMapping);
	}

	fieldMatches.add(node.name)
}

function isNodeImage(node: SceneNode): Boolean {
	let fills = getNodeFills(node)
	if (fills == undefined || fills.length == 0) {
		return false
	}

	for(let paint of fills) {
		if (paint.type == "IMAGE") {
			return true
		}
	}
	
	return false
}

function getNodeFills(node: SceneNode): Array<Paint> {
	let fills = node["fills"] as Array<Paint>
	if (fills == undefined) {
		return new Array()
	}
	return fills
}

function getRestaurantWithId(restaurantId: string): Restaurant {
	return restaurantMap.get(restaurantId)
}

async function updateTextNode(textNode: TextNode, TextMapping: TextMapping) {
	const fonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
	for (const font of fonts) {
		await figma.loadFontAsync(font);
	}
	
	textNode.characters = TextMapping.text; 
}

function updateImageNode(node: SceneNode, imageMapping: ImageMapping) {
	let nodeId = refId;
	refId = refId + 1;
	cacheNodes.set(nodeId, node);
	
	figma.ui.postMessage({ 
		type: 'download_image', 
		nodeId: nodeId, 
		url: imageMapping.imageUrl 
	})
}

function postErrorMessage(text) {
	figma.ui.postMessage({ 
		type: 'error_message', 
		message: text
	})
}

// ----------------------------------------------------------------

function navigateThroughNodes(node: SceneNode, 
	startRestaurantNodeCallback: () => void,
	nodeCallback: (node: SceneNode) => void
) {
	if (node == null) {
		return;
	}

	let children = node["children"] as Array<SceneNode>
	if (children != undefined && children.length > 0) {
		if (node.name == DATA_FIELD_OBJECT) {
			startRestaurantNodeCallback();
		}

		children.forEach(subNode => {
			navigateThroughNodes(subNode, startRestaurantNodeCallback, nodeCallback);
		});
	} else {
		nodeCallback(node);
	}
}

function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}

function buildRestaurantMap() {
	let restaurantMap = new Map<string, Restaurant>()
	let jsonData = getRestaurantsJsonData()
	jsonData.forEach(restaurant => {
		let restaurantId = restaurant.restaurantName
		let category = restaurant.restaurantCategory
		restaurantMap.set(restaurantId, new Restaurant(
			/* restaurantId */ restaurantId,
			/* name */ restaurant.restaurantName,
			/* imageUrl */ restaurant.restaurantImg,
			/* category */ category,
			/* address */ restaurant.address,
			/* intersection */ restaurant.intersection,
			/* cuisines */ restaurant.cuisine,
			/* itemCategories */ restaurant.itemCategories,
			/* itemNames */ restaurant.items,
			/* itemDescriptions */ restaurant.itemDescription
		))
	})
	return restaurantMap
}

function buildCategoryMap() {
	let categoryMap = new Map<string, string[]>()
	restaurantMap.forEach(restaurant => {
		let category = restaurant.category
		let restaurants = categoryMap.has(category) ? categoryMap.get(category) : new Array()
		// debugger
		restaurants.push(restaurant.restaurantId)
		categoryMap.set(category, restaurants)
	})
	return categoryMap
}

const DATA_FIELD_OBJECT = "[restaurant-object]" // top of tree
const DATA_FIELD_NAME = "[restaurant-name]" // single name
const DATA_FIELD_ADDRESS = "[restaurant-address]" // single name
const DATA_FIELD_CUISINE = "[restaurant-cuisine]" // array of strings
const DATA_FIELD_COVER = "[restaurant-cover]" // (single image
const DATA_FIELD_INTERSECTION = "[restaurant-intersection]" // single string
const DATA_FIELD_MENU_CATEGORY = "[restaurant-menu-category]" // array of strings
const DATA_FIELD_MENU_ITEM = "[restaurant-menu-item]" // array of strings
const DATA_FIELD_MENU_DESCRIPTION = "[restaurant-menu-description]" // array of strings

function restaurantToFieldMap(restaurant: Restaurant): Map<string, DataMapping> {
	return new Map<string, DataMapping>([
		[DATA_FIELD_NAME, new SingleTextMapping(restaurant.name)],
		[DATA_FIELD_ADDRESS, new SingleTextMapping(restaurant.address)],
		[DATA_FIELD_INTERSECTION, new SingleTextMapping(restaurant.address)],
		[DATA_FIELD_COVER, new ImageMapping(restaurant.imageUrl)],
		[DATA_FIELD_CUISINE, new RandomTextMapping(restaurant.cuisines)],
		[DATA_FIELD_MENU_DESCRIPTION, new RandomTextMapping(restaurant.itemDescriptions)],
		[DATA_FIELD_MENU_CATEGORY, new RandomTextMapping(restaurant.itemCategories)],
		[DATA_FIELD_MENU_ITEM, new RandomTextMapping(restaurant.itemDescriptions)],
	]);
}

function getRestaurantsJsonData() {
	return [
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Aroma Espresso Bar",
			intersection: "(King/Peter)",
			address: "452 King Street W",
			cuisine: ["Healthy Eats", "Coffee"],
			itemCategories: ["Most Popular", "Hot Drinks", "Breakfast", "Sandwiches", "Treats"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado","Shakshuka", "Cheese Bureka", "Croissant", "Almond Croissant"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
	
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1516743619420-154b70a65fea?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Dineen Coffee Co.",
			intersection: "(Yonge/Elm)",
			address: "4578 Yonge Street",
			cuisine: ["Bakery", "Coffee","Breakfast"],
			itemCategories: ["Coffee", "Drinks", "Bakery", "Dessert", "Gifts"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado","Almond Croissant", "Butter Croissant", "Chocolate Babka", "Hot Chocolate", "Americano", "Latte", "Matcha Green Tea"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1477763858572-cda7deaa9bc5?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Early Bird Bakery",
			intersection: "(Queen/Bathurst)",
			address: "1044 Queen Street W",
			cuisine: ["Lunch", "Breakfast", "Coffee","Bakery"],
			itemCategories: ["Popular", "Cold Drinks", "Hot Drinks", "Food", "Bakery"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado","Eggs Benedict", "Garden Salad", "Croissant", "Almond Croissant"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1611601184963-9d1de9b79ff3?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Ethica Coffee Roasters",
			intersection: "(Sterling/Perth)",
			address: "15 Sterling Road",
			cuisine: ["Sandwiches", "Coffee"],
			itemCategories: ["Specials", "Beans", "Hot Coffee", "Sandwiches", "Bakery", "Breakfast"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado","Shakshuka", "Cheese Bureka", "Croissant", "Almond Croissant"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1552833755-fdb50eeb8cf1?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
			restaurantName: "Fantail",
			intersection: "(King/Peter)",
			address: "91 Peter Street",
			cuisine: ["Coffee", "Tea", "Breakfast"],
			itemCategories: ["Most Popular", "Drinks", "Bakery", "Hot Drinks", "Lunch", "Cold Drinks", "Breakfast", "Beans"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado", "Brioche", "Croissant", "Blueberry Scone", "Flourless Chocolate Cake", "Chocolate Chip Cookie"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1513442542250-854d436a73f2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "What A Bagel",
			intersection: "(Queen/Spadina)",
			address: "187 Spadina Avenue",
			cuisine: ["Coffee", "Breakfast", "Healthy"],
			itemCategories: ["Most Popular", "Drinks", "Bakery", "Hot Drinks", "Lunch", "Cold Drinks", "Breakfast", "Beans"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado", "Brioche", "Croissant", "Blueberry Scone", "Flourless Chocolate Cake", "Chocolate Chip Cookie"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1490457843367-34b21b6ccd85?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Thor Espresso Bar",
			intersection: "(Front/Bathurst)",
			address: "140 Bathurst Street",
			cuisine: ["Coffee", "Tea", "Breakfast"],
			itemCategories: ["Most Popular", "Drinks", "Bakery", "Hot Drinks", "Lunch", "Cold Drinks", "Breakfast"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado", "Brioche", "Croissant", "Blueberry Scone", "Flourless Chocolate Cake", "Chocolate Chip Cookie"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=710&q=80",
			restaurantName: "Strange Love Coffee",
			intersection: "(Spadina/Adelaide)",
			address: "101 Spadina Avenue",
			cuisine: ["Sandwiches", "Coffee", "Treats"],
			itemCategories: ["Most Popular", "Drinks", "Bakery", "Hot Drinks", "Lunch", "Cold Drinks", "Breakfast"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado", "Brioche", "Croissant", "Blueberry Scone", "Flourless Chocolate Cake", "Chocolate Chip Cookie"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1579867779026-d8285a8c9625?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
			restaurantName: "French Made",
			intersection: "(King/Blue Jays Way)",
			address: "80 Blue Jays Way",
			cuisine: ["Coffee", "Breakfast", "Treats", "Bakery"],
			itemCategories: ["Most Popular", "Drinks", "Bakery", "Hot Drinks", "Lunch", "Cold Drinks", "Breakfast"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado", "Brioche", "Croissant", "Blueberry Scone", "Flourless Chocolate Cake", "Chocolate Chip Cookie"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1577590835286-1cdd24c08fd7?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
			restaurantName: "Balzac's Coffee Roasters",
			intersection: "(Up Express)",
			address: "7 Station Street",
			cuisine: ["Coffee", "Breakfast", "Roasters"],
			itemCategories: ["Most Popular", "Drinks", "Bakery", "Hot Drinks", "Lunch", "Cold Drinks", "Breakfast"],
			items: ["Chai Latte","Flat White", "Cappuccino", "London Fog", "Americano", "Brewed Coffee","Mocha", "Macchiato", "Cortado", "Brioche", "Croissant", "Blueberry Scone", "Flourless Chocolate Cake", "Chocolate Chip Cookie"],
			itemDescription: ["Two long shots of espresso stretched with hot water. Made with fair trade organic beans. 12oz.","Made with espresso and milk. 8oz.","Our decadent and warming latte, combined with rich chocolate flavour, steamed milk and topped with real whipped cream and cocoa.","Two eggs, side salad & choice of toast served with cream cheese, house-made avocado spread.","Light and crispy almond biscotti. Baked fresh in store throughout the day.","Our warm & flaky croissants are baked fresh in store throughout the day.","Freshly-baked, soft pastry rolled with cinnamon and sugar and smothered with a rich, real cream cheese glaze.","An irresistible rich and chocolatey brownie-like cookie, delicately coated in icing sugar and baked to perfection.","A delicious pastry filled with halva creme made from tahini, topped with powdered sugar.","A crispy and light cookie made with ground almonds and sugar substitute. Baked fresh in store throughout the day.","Flaky pastry with sweet, fluffy cheesecake filling."],
		},
	
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1607301406259-dfb186e15de8?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Kibo Sushi",
			intersection: "(Charlotte/King)",
			address: "124 Charlotte Street",
			cuisine: ["Sushi", "Japanese"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1570780775848-bc1897788ce0?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Sho Izakaya",
			intersection: "(Queen/Jameson)",
			address: "1406 Queen Street",
			cuisine: ["Sushi", "Japanese"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1534482421-64566f976cfa?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Tatsu Sushi",
			intersection: "(Queen/Niagara)",
			address: "791 Queen Street West",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1625108957587-8585dd1f4d95?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
			restaurantName: "Hapa Izakaya",
			intersection: "(College/Clinton)",
			address: "1039 College Street",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."]
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1588635655481-e1c4e86a378d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Arisu",
			intersection: "(Bloor/Ossington)",
			address: "913 Brock Avenue",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1561466273-c13f88329aa0?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "The Shozan Room",
			intersection: "(Ossington/Foxley)",
			address: "164 Ossington Avenue",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1630698467933-60129917a2c2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Koji Japanese Restaurant",
			intersection: "(Dupont/Perth)",
			address: "1553 Dupont Street",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1562802378-063ec186a863?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80",
			restaurantName: "Shunoko",
			intersection: "(St Clair/Dufferin)",
			address: "1201 St Clair Avenue West",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&q=80",
			restaurantName: "Osaka Sushi",
			intersection: "(Bloor/Indian)",
			address: "1620 Bloor Street West",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1000&q=80",
			restaurantName: "Sho Izakaya",
			intersection: "(Queen/Jameson)",
			address: "1406 Queen Street West",
			cuisine: ["Lunch", "Sushi","Japanese","Dinner"],
			itemCategories: ["Most Popular","Classic Rolls", "Hand Rolls", "Veggie Rolls", "Dragon Special Rolls", "Aburi", "Soup and Salad", "Rice", "Appetizer","Boat Tray", "Donburi", "Udon","Bento","A la Carte", "Beverages"],
			items: ["Spicy Salmon Roll", "Spicy Tuna Roll", "Salmon and Avocado Roll","California Roll", "Spicy Scallop Roll", "Tuna Roll", "Asparagus Tempura Roll", "Inari and Avocado Roll", "Spicy Yam and Avocado Roll","Dragon Roll", "Aburi Salmon Dragon Roll", "Aburi Scallop Roll","Miso Soup", "Veggie Gyoza","Kani Salad","Sushi Rice","Steamed Rice", "Wakame Salad", "Edamame", "Soft-Shell Crab Tempura", "Chicken Karaage"],
			itemDescription: ["Avocado, cucumber, asparagus tempura, yam tempura topped with avocado. 10 pcs.","Salmon, tempura bits, spicy mayo.","Avocado, cucumber, crab meat, fish roe.","Scallop, tempura bits, Japanese mayo.","Shrimp tempura, avocado, cucumber, crab meat and yam tempura. 10 pcs.","Torched with aburi sauce. 10 pcs.","Topped with spicy salmon. 10 pcs.","Deep fried roll with unagi & avocado. 10 pcs.","Avocado, cucumber, tamago, shiitake mushroom, crab meat, pickled radish. 10 pcs.","Two miso soup and salad, edamame, mixed tempura. 36 pcs - sashimi, sushi & roll.","Served with your choice of protein. Served with soup & salad.","Served with soup and salad","Assorted sushi 12 pcs, red dragon roll 10 pcs, California roll 6 pcs, spicy salmon roll 6 pcs.","Assorted sashimi & sushi 20 pcs, red dragon roll 10 pcs, spicy salmon roll 6 pcs."],
		}
	]
	
}