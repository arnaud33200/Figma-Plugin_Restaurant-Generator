// Doesn't work :/
// import * as importAll from "./script/test";

figma.showUI(__html__);
figma.ui.resize(350, 320);

class Merchant {
	constructor(
		readonly merchantId: string,
		readonly name: string, 
		readonly cuisine: string,
		readonly address: string,
		readonly coverUrl: string
	) {}
}

const DATA_FIELD_NAME = "[data-name]";
const DATA_FIELD_CUISINE = "[data-cuisine]";
const DATA_FIELD_ADDRESS = "[data-address]";
const DATA_FIELD_COVER = "[data-cover]";

var refId = 0;
let cacheNodes = new Map<number, SceneNode>()

let merchantCollection = new Map<string, Merchant>([
	["merchant1", new Merchant(
		/* id */ "merchant1",
		/* name */ "Pizza Pizza my dude",
		/* cuisine */ "Pizza",
		/* address */ "340 Front St W, Toronto, ON M5V 3W7",
		/* coverUrl */ "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=781&q=80"
		
	)],
	["merchant2", new Merchant(
		/* id */ "merchant2",
		/* name */ "Frozen Sushi",
		/* cuisine */ "japanese",
		/* address */ "409 Richmond St W, Toronto, ON M5V 1X2",
		/* coverUrl */ "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80"
	)],
	["merchant3", new Merchant(
		/* id */ "merchant3",
		/* name */ "Frasheee",
		/* cuisine */ "Salad",
		/* address */ "310 Richmond St W, Toronto, ON M5V 1X2",
		/* coverUrl */ "https://images.unsplash.com/photo-1607532941433-304659e8198a?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1078&q=80"
	)]
]);

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

	// TODO - setup action with mutiple ids (random, sequence, ...)
	let merchantId = merchantIds[0]

	let selectedMerchant = getMerchantWithId(merchantId);
	let merchantDataMap = merchantToMap(selectedMerchant);

	let selectedNodes = figma.currentPage.selection
	if (selectedNodes.length == 0) {
		postErrorMessage("Please select a Component or a Group before applying restaurant data.")
		return
	}

	selectedNodes.forEach(selection => {
		navigateThroughNodes(selection, node => {
			checkNodeMapping(node, merchantDataMap)
		}) 
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
		[DATA_FIELD_COVER, merchant.coverUrl],
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

function navigateThroughNodes(node: SceneNode, callback: (node: SceneNode) => void) {
	if (node == null) {
		return;
	}

	let children = node["children"] as Array<SceneNode>
	debugger;
	if (children != undefined && children.length > 0) {
		children.forEach(subNode => {
			navigateThroughNodes(subNode, callback);
		});
	} else {
		callback(node);
	}
}