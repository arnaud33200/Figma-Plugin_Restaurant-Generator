figma.showUI(__html__);
figma.ui.resize(350, 320);

class Restaurant {
	constructor(
		readonly restaurantId: string,
		readonly name: string, 
		readonly category: string,
		readonly cuisine: string,
		readonly address: string,
		readonly imageUrl: string
	) {}
}

const DATA_FIELD_NAME = "[data-name]";
const DATA_FIELD_CUISINE = "[data-cuisine]";
const DATA_FIELD_ADDRESS = "[data-address]";
const DATA_FIELD_COVER = "[data-cover]";

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
	let restaurants = categoryMap.get(category)
	populateComponent(restaurants)
}

function populateComponent(restaurantIds: Array<string>) {
	fieldMatches.clear();

	if (restaurantIds.length == 0) {
		return; // nothing to map
	}

	// TODO - setup action with mutiple ids (random, sequence, ...)
	var selectedRestaurantIndex = 0;
	var restaurantFieldMap = new Map<string, string>([]);

	let selectedNodes = figma.currentPage.selection
	if (selectedNodes.length == 0) {
		postErrorMessage("Please select a Component or a Group before applying restaurant data.")
		return
	}

	selectedNodes.forEach(selection => {
		navigateThroughNodes(selection, 
			() => {
				// TODO - setup random or other depending on the action
				selectedRestaurantIndex = getRandomInt(restaurantIds.length)

				let restaurantId = restaurantIds[selectedRestaurantIndex];
				let selectedRestaurant = getRestaurantWithId(restaurantId);
				restaurantFieldMap = restaurantToFieldMap(selectedRestaurant);
			}, node => {
				checkNodeMapping(node, restaurantFieldMap)
			}
		) 
	})

	if (fieldMatches.size == 0) {
		var keysText = ""
		restaurantFieldMap.forEach((value, key) => {
			if (keysText.length > 0) { keysText += ", " }
			keysText += key
		});
		let message = "Failed to apply restaurant data. The fields in the selected Component(s) or Group(s) should be renamed to the following options:<br><br>" + keysText
		postErrorMessage(message)
	}
}

function checkNodeMapping(node: SceneNode, dataMap: Map<string, string>) {
	if (!dataMap.has(node.name)) {
		return;
	}

	fieldMatches.add(node.name)

	if (node.type === "TEXT") {
		updateTextNode(node as  TextNode, dataMap);
	}
	else if (isNodeImage(node)) {
		updateImageNode(node, dataMap);
	}
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

function restaurantToFieldMap(restaurant: Restaurant): Map<string, string> {
	return new Map<string, string>([
		[DATA_FIELD_NAME, restaurant.name],
		[DATA_FIELD_CUISINE, restaurant.cuisine],
		[DATA_FIELD_ADDRESS, restaurant.address],
		[DATA_FIELD_COVER, restaurant.imageUrl],
	]);
}

async function updateTextNode(textNode: TextNode, dataMap: Map<string, string>) {
	const fonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
	for (const font of fonts) {
		await figma.loadFontAsync(font);
	}
	
	textNode.characters = dataMap.get(textNode.name); 
}

function updateImageNode(node: SceneNode, dataMap: Map<string, string>) {
	let nodeId = refId;
	refId = refId + 1;
	cacheNodes.set(nodeId, node);
	
	figma.ui.postMessage({ 
		type: 'download_image', 
		nodeId: nodeId, 
		url: dataMap.get(node.name) 
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
		// TODO - check if node has a "[restaurant-node]" name and call callback
		startRestaurantNodeCallback();

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
		let cuisine = restaurant.cuisine.length > 0 ? restaurant.cuisine[0] : ""
		restaurantMap.set(restaurantId, new Restaurant(
			/* restaurantId */ restaurantId,
			/* name */ restaurant.restaurantName,
			/* category */ category,
			/* cuisine */ cuisine,
			/* address */ restaurant.address,
			/* imageUrl */ restaurant.restaurantImg
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

function getRestaurantsJsonData() {
	return [
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1742&q=80",
			restaurantName: "Aroma Espresso Bar",
			intersection: "(King/Peter)",
			address: "452 King Street W",
			cuisine: ["Healthy Eats", "Coffee"],
			itemCategories: ["Most Popular", "Hot Drinks", "Breakfast", "Sandwiches", "Treats"],
			item: ["Shakshuka", "Cheese Bureka", "Croissant", "Almond Croissant"],
			itemDescriprion: ["Shots of our signature epsresso blend, topped with foamed milk."]
		},
		{
			restaurantCategory: "Coffee",
			restaurantImg: "https://images.unsplash.com/photo-1551887196-72e32bfc7bf3?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1329&q=80",
			restaurantName: "Ethica Coffee Roasters",
			intersection: "(Sterling/Perth)",
			address: "15 Sterling Road",
			cuisine: ["Sandwiches", "Coffee"],
			itemCategories: ["Specials", "Beans", "Hot Coffee", "Sandwiches", "Bakery"],
			item: ["Shakshuka", "Cheese Bureka", "Croissant", "Almond Croissant"],
			itemDescriprion: ["Our signature bean blend roasted and pulled into a rich and complex shot of espresso."],
			
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1607301406259-dfb186e15de8?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1811&q=80",
			restaurantName: "Kibo Sushi",
			intersection: "(Charlotte/King)",
			address: "124 Charlotte Street",
			cuisine: ["Sushi", "Japanese"],
			itemCategories: ["Specials", "Beans", "Hot Coffee", "Sandwiches", "Bakery"],
			item: ["Salmon Nigiri", "Butterfish Nigiri", "Aburi Salmon", "Salmon Sashimi"],
			itemDescriprion: ["Blow torched salmon with yuzu mustard mayo, truffle oil. 6 pieces"],
			
		},
		{
			restaurantCategory: "Sushi",
			restaurantImg: "https://images.unsplash.com/photo-1570780775848-bc1897788ce0?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1740&q=80",
			restaurantName: "Sho Izakaya",
			intersection: "(Queen/Jameson)",
			address: "1406 Queen Street",
			cuisine: ["Sushi", "Japanese"],
			itemCategories: ["Daily Specials", "Appetizers", "Ramen", "Udon", "Poke Bowls", "Rice Dishes"],
			item: ["Hamachi Sashimi", "Salmon Poke Bowl", "Tuna Poke Bowl", "Sashimi Trio"],
			itemDescriprion: ["Salmon, avocado, mango, poke sauce, mixed greens and rice."],
			
		},
	]
}