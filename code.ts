// Doesn't work :/
// import * as importAll from "./script/test";

figma.showUI(__html__);
figma.ui.resize(350, 320);

class Merchant {
	constructor(
		readonly merchantId: string,
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

// Categorie --> list of merchant

let merchantCollection = buildMerchantCollection();


// ################################################################################################
// ################################################################################################

var fieldMatches = new Set();

figma.ui.onmessage = msg => {
	if (msg.type === 'get_merchants') { postMessageListMerchant(); }
	if (msg.type === 'populate_merchant_node') { populateComponent(msg.merchantIds); }
	else if (msg.type === 'on_image_data_response') { setImageRectangleNote(msg.nodeId, msg.data); }
};

function postMessageListMerchant() {
	let merchants = [];
	merchantCollection.forEach(element => {
		merchants.push(element)
	})

	figma.ui.postMessage({ 
		type: 'merchants_response', 
		merchants: merchants
	})
}

function setImageRectangleNote(nodeId: number, data: Uint8Array) {
	let node = cacheNodes.get(nodeId) as RectangleNode;
	cacheNodes.delete(nodeId)
	node.fills = [{type: 'IMAGE', imageHash: figma.createImage(data).hash, scaleMode: "FILL"}];
}

function populateComponent(merchantIds: Array<string>) {
	fieldMatches.clear();

	if (merchantIds.length == 0) {
		return; // nothing to map
	}

	// TODO - setup action with mutiple ids (random, sequence, ...)
	var selectedMerchantIndex = 0;
	var merchantDataMap = new Map<string, string>([]);

	let selectedNodes = figma.currentPage.selection
	if (selectedNodes.length == 0) {
		postErrorMessage("Please select a Component or a Group before applying restaurant data.")
		return
	}

	selectedNodes.forEach(selection => {
		navigateThroughNodes(selection, 
			() => {
				// TODO - setup random or other depending on the action
				selectedMerchantIndex = getRandomInt(merchantIds.length)

				let merchantId = merchantIds[selectedMerchantIndex];
				let selectedMerchant = getMerchantWithId(merchantId);
				merchantDataMap = merchantToMap(selectedMerchant);
			}, node => {
				checkNodeMapping(node, merchantDataMap)
			}
		) 
	})

	if (fieldMatches.size == 0) {
		var keysText = ""
		merchantDataMap.forEach((value, key) => {
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
	else if (node.type === "RECTANGLE") {
		updateImageRectNode(node as RectangleNode, dataMap);
	}
}

function getMerchantWithId(merchantId: string): Merchant {
	return merchantCollection.get(merchantId)
}

function merchantToMap(merchant: Merchant): Map<string, string> {
	return new Map<string, string>([
		[DATA_FIELD_NAME, merchant.name],
		[DATA_FIELD_CUISINE, merchant.cuisine],
		[DATA_FIELD_ADDRESS, merchant.address],
		[DATA_FIELD_COVER, merchant.imageUrl],
	]);
}

async function updateTextNode(textNode: TextNode, dataMap: Map<string, string>) {
	const fonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
	for (const font of fonts) {
		await figma.loadFontAsync(font);
	}
	
	textNode.characters = dataMap.get(textNode.name); 
}

function updateImageRectNode(rectNode: RectangleNode, dataMap: Map<string, string>) {
	let rectId = refId;
	refId = refId + 1;
	cacheNodes.set(rectId, rectNode);
	
	figma.ui.postMessage({ 
		type: 'download_image', 
		nodeId: rectId, 
		url: dataMap.get(rectNode.name) 
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
	debugger;
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

function buildMerchantCollection() {
	let merchantMap = new Map<string, Merchant>()
	let jsonData = getMerchantJsonData()
	jsonData.forEach(merchant => {
		let merchantId = merchant.restaurantName
		let category = merchant.restaurantCategory
		let cuisine = merchant.cuisine.length > 0 ? merchant.cuisine[0] : ""
		merchantMap.set(merchantId, new Merchant(
			/* merchantId */ merchantId,
			/* name */ merchant.restaurantName,
			/* category */ category,
			/* cuisine */ cuisine,
			/* address */ merchant.address,
			/* imageUrl */ merchant.restaurantImg
		))
	})
	return merchantMap
}

function getMerchantJsonData() {
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