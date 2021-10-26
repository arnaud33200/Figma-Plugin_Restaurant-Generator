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
		/* coverUrl */ "https://lh3.googleusercontent.com/y5o7JGsPIesdipRCQV68qwDvdsw8VTuhUgtYxfYEUO-JfxSEA7F15uTQOM-6vy69qyWRBHXglBFuAd42R6Sc1kME4A"
		
	)],
	["merchant2", new Merchant(
		/* id */ "merchant2",
		/* name */ "Frozen Sushi",
		/* cuisine */ "japanese",
		/* address */ "409 Richmond St W, Toronto, ON M5V 1X2",
		/* coverUrl */ "https://images.indianexpress.com/2019/06/sushi-gettyimages-759.jpg"
	)],
	["merchant3", new Merchant(
		/* id */ "merchant3",
		/* name */ "Frasheee",
		/* cuisine */ "Salad",
		/* address */ "310 Richmond St W, Toronto, ON M5V 1X2",
		/* coverUrl */ "https://www.recipetineats.com/wp-content/uploads/2021/08/Garden-Salad_48.jpg?resize=650,910"
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