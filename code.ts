// Doesn't work :/
// import * as importAll from "./script/test";

figma.showUI(__html__);

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

// this link works fine
// "https://cdn-beaai.nitrocdn.com/DsHNrqyidSdrnEUwxpnDFmLjguAlTfrt/assets/static/optimized/rev-f639137/wp-content/uploads/2015/08/colorblind-test-image1.jpg"

// this doesn't work
// "https://www.recipetineats.com/wp-content/uploads/2020/05/Pepperoni-Pizza_5-SQjpg.jpg"

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

figma.ui.onmessage = msg => {
	if (msg.type === 'get_merchants') { postMessageListMerchant(); }
	if (msg.type === 'populate_merchant_node') { populateComponent(msg.merchantId); }
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

function populateComponent(merchantId: string) {
	let selectedMerchant = getMerchantWithId(merchantId);
	let merchantDataMap = merchantToMap(selectedMerchant);

	figma.currentPage.selection.forEach(selection => {
		navigateThroughNodes(selection, node => {
			if (node.type === "TEXT") {
				updateTextNode(node as TextNode, merchantDataMap);
			}
			else if (node.type === "RECTANGLE") {
				updateImageRectNode(node as RectangleNode, merchantDataMap);
			}
		}) 
	})
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
	if (!dataMap.has(textNode.name)) {
		return;
	}
	const fonts = textNode.getRangeAllFontNames(0, textNode.characters.length);
	for (const font of fonts) {
		await figma.loadFontAsync(font);
	}
	
	textNode.characters = dataMap.get(textNode.name); 
}

function updateImageRectNode(rectNode: RectangleNode, dataMap: Map<string, string>) {
	if (!dataMap.has(rectNode.name)) {
		return;
	}

	let rectId = refId;
	refId = refId + 1;
	cacheNodes.set(rectId, rectNode);
	
	figma.ui.postMessage({ 
		type: 'download_image', 
		nodeId: rectId, 
		url: dataMap.get(rectNode.name) 
	})
}

// ----------------------------------------------------------------

function navigateThroughNodes(node: SceneNode, callback: (node: SceneNode) => void) {
	if (node == null) {
		return;
	}
	
	if (node.type === "INSTANCE" ||node.type === "COMPONENT" 
	|| node.type === "COMPONENT_SET" || node.type === "GROUP") {
		node.children.forEach(subNode => {
			navigateThroughNodes(subNode, callback);
		});
	} else {
		callback(node);
	}
}