const xmlFileInput      = document.getElementById('xmlFile');
const fileNameDisplay   = document.getElementById('file-name-display');
const convertBtn        = document.getElementById('convertBtn');
const luaOutputTextarea = document.getElementById('luaOutput');
const loadingIndicator  = document.getElementById('loadingIndicator');
const toast             = document.getElementById('toast');

let xmlContent = null;

// Get the file input label div
const fileInputLabel = document.querySelector('.file-input-label');

// Event Listeners
xmlFileInput.addEventListener('change', (event) => {
	const file = event.target.files[0];
	if (file) {
		fileNameDisplay.textContent = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			xmlContent = e.target.result;
			convertBtn.disabled = false;
		};
		reader.onerror = () => {
			alert('Error reading file.');
			resetUI();
		};
		reader.readAsText(file);
	} else {
		resetUI();
	}
});

convertBtn.addEventListener('click', () => {
	if (!xmlContent) {
		alert('Please upload an XML file first.');
		return;
	}

	loadingIndicator.style.display = 'flex';
	setTimeout(() => {
		try {
			const luaCode = convertXmlToLua(xmlContent);
			luaOutputTextarea.value = luaCode;
		} catch (error) {
			console.error("Conversion Error:", error);
			alert(`Error during conversion: ${error.message}\nCheck console for more details.`);
			luaOutputTextarea.value = `Error during conversion: ${error.message}`;
		} finally {
			loadingIndicator.style.display = 'none';
		}
	}, 50);
});

// Add drag and drop listeners to the file input label div
fileInputLabel.addEventListener('dragover', (event) => {
	event.preventDefault(); // Prevent default to allow drop
	fileInputLabel.classList.add('drag-over'); // Optional: add a class for visual feedback
});

fileInputLabel.addEventListener('dragleave', () => {
	fileInputLabel.classList.remove('drag-over'); // Optional: remove class
});

fileInputLabel.addEventListener('drop', (event) => {
	event.preventDefault(); // Prevent default to process file
	fileInputLabel.classList.remove('drag-over'); // Optional: remove class

	const file = event.dataTransfer.files[0]; // Get the first dropped file
	if (file) {
		// Reuse the existing file reading logic
		fileNameDisplay.textContent = file.name;
		const reader = new FileReader();
		reader.onload = (e) => {
			xmlContent = e.target.result;
			convertBtn.disabled = false;
		};
		reader.onerror = () => {
			alert('Error reading file.');
			resetUI();
		};
		reader.readAsText(file);
	} else {
		resetUI();
	}
});

function resetUI() {
	xmlContent                  = null;
	fileNameDisplay.textContent = 'Click or drag XML file here';
	convertBtn.disabled         = true;
	luaOutputTextarea.value     = '';
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add('show');
	setTimeout(() => toast.classList.remove('show'), 3000);
}

// Helper functions for XML parsing
function getText(node, query) {
	const child = node.querySelector(query);
	return child ? child.textContent.trim() : null;
}
function getFloat(node, query, defaultValue = 0.0) {
	const text = getText(node, query);
	const value = parseFloat(text);
	return !isNaN(value) ? value : defaultValue;
}
function getInt(node, query, defaultValue = 0) {
	const text = getText(node, query);
	const value = parseInt(text);
	return !isNaN(value) ? value : defaultValue;
}
function getBool(node, query, defaultValue = false) {
	const text = getText(node, query);
	return text ? (text.toLowerCase() === 'true') : defaultValue;
}
function getHex(node, query) {
	const text = getText(node, query);
	return text ? text : null;
}

// Main conversion logic
function convertXmlToLua(xmlString) {
	const parser = new DOMParser();
	const xmlDoc = parser.parseFromString(xmlString, "application/xml");

	if (xmlDoc.getElementsByTagName("parsererror").length > 0) throw new Error("Invalid XML file format.");

	let luaCode = ``;
	luaCode += `local createdEntities = {}\n\n`;

	luaCode += `local function RequestAndLoadModel(modelHash)\n`;
	luaCode += `    if not IsModelInCdimage(modelHash) or not IsModelValid(modelHash) then\n`;
	luaCode += `        print(('[^1ERROR^7] Model %s is not valid or not in CD image.'):format(modelHash))\n`;
	luaCode += `        return false\n`;
	luaCode += `    end\n`;
	luaCode += `    RequestModel(modelHash)\n`;
	luaCode += `    local timeout = 5000 -- 5 seconds timeout\n`;
	luaCode += `    local startTime = GetGameTimer()\n`;
	luaCode += `    while not HasModelLoaded(modelHash) do\n`;
	luaCode += `        Wait(0)\n`;
	luaCode += `        if GetGameTimer() - startTime > timeout then\n`;
	luaCode += `            print(('[^1ERROR^7] Failed to load model %s within timeout.'):format(modelHash))\n`;
	luaCode += `            SetModelAsNoLongerNeeded(modelHash)\n`;
	luaCode += `            return false\n`;
	luaCode += `        end\n`;
	luaCode += `    end\n`;
	luaCode += `    return true\n`;
	luaCode += `end\n\n`;

	luaCode += `local function SpawnProp(data)\n`;
	luaCode += `    CreateThread(function()\n`;
	luaCode += `        if not RequestAndLoadModel(data.modelHash) then return end\n\n`;
	luaCode += `        local prop = CreateObjectNoOffset(data.modelHash, data.coords.x, data.coords.y, data.coords.z, false, false, data.dynamic)\n`;
	luaCode += `        table.insert(createdEntities, prop)\n\n`;
	luaCode += `        SetEntityCoordsNoOffset(prop, data.coords.x, data.coords.y, data.coords.z)\n`;
	luaCode += `        SetEntityRotation(prop, data.rotation.x, data.rotation.y, data.rotation.z, 2, true)\n`;
	luaCode += `        \n`;
	luaCode += `        FreezeEntityPosition(prop, data.frozenPos)\n`;
	luaCode += `        if data.lodDistance then SetEntityLodDist(prop, data.lodDistance) end\n`;
	luaCode += `        if data.opacityLevel then SetEntityAlpha(prop, data.opacityLevel, false) end\n`;
	luaCode += `        if data.isVisible ~= nil then SetEntityVisible(prop, data.isVisible, false) end\n`;
	luaCode += `        if data.maxHealth then SetEntityMaxHealth(prop, data.maxHealth) end\n`;
	luaCode += `        if data.health then SetEntityHealth(prop, data.health) end\n`;
	luaCode += `        if data.isInvincible ~= nil then SetEntityInvincible(prop, data.isInvincible) end\n`;
	luaCode += `        if data.isCollisionProof ~= nil then SetEntityCollision(prop, not data.isCollisionProof, false) end\n`; // Corrected collision logic
	luaCode += `        if data.textureVariation then SetObjectTextureVariant(prop, data.textureVariation) end\n\n`;
	luaCode += `        SetEntityAsMissionEntity(prop, true, true)\n`;
	luaCode += `        SetModelAsNoLongerNeeded(data.modelHash)\n`;
	luaCode += `    end)\n`;
	luaCode += `end\n\n`;

	luaCode += `local function SpawnPed(data)\n`;
	luaCode += `    CreateThread(function()\n`;
	luaCode += `        if not RequestAndLoadModel(data.modelHash) then return end\n\n`;
	luaCode += `        local ped = CreatePed(4, data.modelHash, data.coords.x, data.coords.y, data.coords.z, data.rotation.z, false, not data.dynamic)\n`;
	luaCode += `        table.insert(createdEntities, ped)\n\n`;
	luaCode += `        SetEntityCoordsNoOffset(ped, data.coords.x, data.coords.y, data.coords.z)\n`;
	luaCode += `        SetEntityRotation(ped, data.rotation.x, data.rotation.y, data.rotation.z, 2, true)\n`;
	luaCode += `        \n`;
	luaCode += `        FreezeEntityPosition(ped, data.frozenPos)\n`;
	luaCode += `        if data.lodDistance then SetEntityLodDist(ped, data.lodDistance) end\n`;
	luaCode += `        if data.opacityLevel then SetEntityAlpha(ped, data.opacityLevel, false) end\n`;
	luaCode += `        if data.isVisible ~= nil then SetEntityVisible(ped, data.isVisible, false) end\n`;
	luaCode += `        if data.maxHealth then SetEntityMaxHealth(ped, data.maxHealth) end\n`;
	luaCode += `        if data.health then SetEntityHealth(ped, data.health) end\n`;
	luaCode += `        if data.isInvincible ~= nil then SetEntityInvincible(ped, data.isInvincible) end\n`;
	luaCode += `        if data.isCollisionProof ~= nil then SetEntityCollision(ped, not data.isCollisionProof, false) end\n`; // Corrected collision logic
	luaCode += `        \n`;
	luaCode += `        if data.armour then SetPedArmour(ped, data.armour) end\n`;
	luaCode += `        if data.currentWeapon and data.currentWeapon ~= 0 and data.currentWeapon ~= GetHashKey("WEAPON_UNARMED") then\n`;
	luaCode += `            GiveWeaponToPed(ped, data.currentWeapon, 250, false, true)\n`;
	luaCode += `        end\n\n`;
	luaCode += `        if data.pedComps then\n`;
	luaCode += `            for compId, compData in pairs(data.pedComps) do\n`;
	luaCode += `                if compData.drawable ~= -1 then\n`;
	luaCode += `                    SetPedComponentVariation(ped, compId, compData.drawable, compData.texture, compData.palette or 0)\n`;
	luaCode += `                end\n`;
	luaCode += `            end\n`;
	luaCode += `        end\n\n`;
	luaCode += `        if data.pedProps then\n`;
	luaCode += `            for propId, propData in pairs(data.pedProps) do\n`;
	luaCode += `                 if propData.drawable ~= -1 then\n`;
	luaCode += `                    SetPedPropIndex(ped, propId, propData.drawable, propData.texture, true)\n`;
	luaCode += `                end\n`;
	luaCode += `            end\n`;
	luaCode += `        end\n\n`;
	luaCode += `        if data.isStill then\n`;
	luaCode += `            SetPedKeepTask(ped, true)\n`;
	luaCode += `            SetBlockingOfNonTemporaryEvents(ped, true)\n`;
	luaCode += `        end\n`;
	luaCode += `        if data.canRagdoll ~= nil then SetPedCanRagdoll(ped, data.canRagdoll) end\n\n`;
	luaCode += `        if data.animActive and data.animDict and data.animName then\n`;
	luaCode += `            RequestAnimDict(data.animDict)\n`;
	luaCode += `            local animTimeout = 3000\n`;
	luaCode += `            local animStartTime = GetGameTimer()\n`;
	luaCode += `            while not HasAnimDictLoaded(data.animDict) do\n`;
	luaCode += `                Wait(0)\n`;
	luaCode += `                if GetGameTimer() - animStartTime > animTimeout then break end\n`;
	luaCode += `            end\n`;
	luaCode += `            if HasAnimDictLoaded(data.animDict) then\n`;
	luaCode += `                TaskPlayAnim(ped, data.animDict, data.animName, 8.0, -8.0, -1, 1, 0, false, false, false)\n`;
	luaCode += `            end\n`;
	luaCode += `        elseif data.scenarioActive and data.scenarioName then\n`;
	luaCode += `            TaskStartScenarioInPlace(ped, data.scenarioName, 0, true)\n`;
	luaCode += `        end\n\n`;
	luaCode += `        SetEntityAsMissionEntity(ped, true, true)\n`;
	luaCode += `        SetModelAsNoLongerNeeded(data.modelHash)\n`;
	luaCode += `    end)\n`;
	luaCode += `end\n\n`;

	luaCode += `local placementsData = {\n`;

	const placements = xmlDoc.getElementsByTagName("Placement");
	for (let i = 0; i < placements.length; i++) {
		const placement = placements[i];
		luaCode += `    {\n`;

		const modelHash = getHex(placement, "ModelHash");
		const type = getInt(placement, "Type");
		const hashName = getText(placement, "HashName") || "Unknown Entity";

		luaCode += `        type = ${type}, -- ${hashName.replace(/--/g, '-')}\n`; // Sanitize comments
		luaCode += `        modelHash = ${modelHash},\n`;
		luaCode += `        hashName = "${hashName.replace(/"/g, '\\"')}",\n`;

		const posRot = placement.querySelector("PositionRotation");
		if (posRot) {
			luaCode += `        coords = vector3(${getFloat(posRot, "X")}, ${getFloat(posRot, "Y")}, ${getFloat(posRot, "Z")}),\n`;
			luaCode += `        rotation = vector3(${getFloat(posRot, "Pitch")}, ${getFloat(posRot, "Roll")}, ${getFloat(posRot, "Yaw")}),\n`;
		}

		luaCode += `        dynamic = ${getBool(placement, "Dynamic")},\n`;
		luaCode += `        frozenPos = ${getBool(placement, "FrozenPos")},\n`;
		if (getText(placement, "LodDistance")) luaCode += `        lodDistance = ${getInt(placement, "LodDistance", 16960)},\n`;
		if (getText(placement, "OpacityLevel")) luaCode += `        opacityLevel = ${getInt(placement, "OpacityLevel", 255)},\n`;
		if (getText(placement, "IsVisible")) luaCode += `        isVisible = ${getBool(placement, "IsVisible", true)},\n`;
		if (getText(placement, "MaxHealth")) luaCode += `        maxHealth = ${getInt(placement, "MaxHealth", type === 1 ? 200 : 1000)},\n`;
		if (getText(placement, "Health")) luaCode += `        health = ${getInt(placement, "Health", type === 1 ? 200 : 1000)},\n`;
		if (getText(placement, "IsInvincible")) luaCode += `        isInvincible = ${getBool(placement, "IsInvincible")},\n`;
		if (getText(placement, "IsCollisionProof")) luaCode += `        isCollisionProof = ${getBool(placement, "IsCollisionProof")},\n`;


		if (type === 1) { // Ped
			const pedPropsNode = placement.querySelector("PedProperties");
			if (pedPropsNode) {
				if (getText(pedPropsNode, "Armour")) luaCode += `        armour = ${getInt(pedPropsNode, "Armour")},\n`;
				const weaponHash = getHex(pedPropsNode, "CurrentWeapon");
				if (weaponHash) luaCode += `        currentWeapon = ${weaponHash},\n`;

				const pedCompsNode = pedPropsNode.querySelector("PedComps");
				if (pedCompsNode) {
					luaCode += `        pedComps = {\n`;
					for (let c = 0; c <= 11; c++) {
						const compVal = getText(pedCompsNode, `_${c}`);
						if (compVal && compVal !== "-1,-1") {
							const parts = compVal.split(',');
							luaCode += `            [${c}] = { drawable = ${parseInt(parts[0])}, texture = ${parseInt(parts[1])} },\n`;
						}
					}
					luaCode += `        },\n`;
				}

				const pedPropsXmlNode = pedPropsNode.querySelector("PedProps");
				if (pedPropsXmlNode) {
					luaCode += `        pedProps = {\n`;
					const propSlots = [0, 1, 2, 6, 7];
					for (const p of propSlots) {
						const propVal = getText(pedPropsXmlNode, `_${p}`);
						if (propVal && propVal !== "-1,-1") {
							const parts = propVal.split(',');
							luaCode += `            [${p}] = { drawable = ${parseInt(parts[0])}, texture = ${parseInt(parts[1])} },\n`;
						}
					}
					luaCode += `        },\n`;
				}

				if (getText(pedPropsNode, "IsStill")) luaCode += `        isStill = ${getBool(pedPropsNode, "IsStill")},\n`;
				if (getText(pedPropsNode, "CanRagdoll")) luaCode += `        canRagdoll = ${getBool(pedPropsNode, "CanRagdoll", true)},\n`;

				const animActive = getBool(pedPropsNode, "AnimActive");
				const scenarioActive = getBool(pedPropsNode, "ScenarioActive");

				if (animActive) {
					luaCode += `        animActive = true,\n`;
					luaCode += `        animDict = "${(getText(pedPropsNode, "AnimDict") || "").replace(/"/g, '\\"')}",\n`;
					luaCode += `        animName = "${(getText(pedPropsNode, "AnimName") || "").replace(/"/g, '\\"')}",\n`;
				} else if (scenarioActive) {
					luaCode += `        scenarioActive = true,\n`;
					luaCode += `        scenarioName = "${(getText(pedPropsNode, "ScenarioName") || "").replace(/"/g, '\\"')}",\n`;
				}
			}
		} else if (type === 3) { // Prop
			const objPropsNode = placement.querySelector("ObjectProperties");
			if (objPropsNode && getText(objPropsNode, "TextureVariation")) {
				luaCode += `        textureVariation = ${getInt(objPropsNode, "TextureVariation")},\n`;
			}
		}

		if (luaCode.endsWith(",\n")) luaCode = luaCode.substring(0, luaCode.length - 2) + "\n";

		luaCode += `    },\n`;
	}

	if (luaCode.endsWith(",\n")) luaCode = luaCode.substring(0, luaCode.length - 2) + "\n";

	luaCode += `}\n\n`;

	luaCode += `CreateThread(function()\n`;
	luaCode += `    for _, data in ipairs(placementsData) do\n`;
	luaCode += `        if data.type == 1 then\n`;
	luaCode += `            SpawnPed(data)\n`;
	luaCode += `        elseif data.type == 3 then\n`;
	luaCode += `            SpawnProp(data)\n`;
	luaCode += `        end\n`;
	luaCode += `        Wait(50) \n`;
	luaCode += `    end\n`;
	luaCode += `end)\n\n`;

	luaCode += `AddEventHandler('onClientResourceStop', function(resourceName)\n`;
	luaCode += `    if GetCurrentResourceName() == resourceName then\n`;
	luaCode += `        for _, entity in ipairs(createdEntities) do\n`;
	luaCode += `            if DoesEntityExist(entity) then\n`;
	luaCode += `                SetEntityAsMissionEntity(entity, false, true)\n`;
	luaCode += `                DeleteEntity(entity)\n`;
	luaCode += `            end\n`;
	luaCode += `        end\n`;
	luaCode += `        createdEntities = {}\n`;
	luaCode += `    end\n`;
	luaCode += `end)\n`;

	return luaCode;
}
