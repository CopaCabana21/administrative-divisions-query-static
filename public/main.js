import {getNominatimSearch, addListElement, makeOSMIdsSlippyMap, removeListElements, getRelation, makeOSMDataIndex, flattenTree, buildTree} from './utils.js';
import './bundle.js';


// var input = document.querySelector("input");
// input.setAttribute('size',input.getAttribute('placeholder').length);

/* Initialize map and set to world */
/* leaflet adds the class leaflet-container to the element */
const map = L.map('myMap').setView([0,0], 1);
const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 15,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});

layer.addTo(map);

/* handle search form */
document.getElementById('countrySearchForm').addEventListener("submit", function(event){
    /* prevents the default behaviour of the form */
    event.preventDefault();
    const searchQuery = document.querySelector('#countrySearchForm > input').value;

    /* remove previous search elements */
    removeListElements();

    getNominatimSearch(searchQuery)
        .then(res =>{
            //! /* pass only the name and id */
            //! let searchData = res.map(x => [x.name, x.osm_id]);

            // document.getElementById('listSelector').innerHTML = '';
            /* filter res */
            let resFilter = res.filter(ele => ele.osm_type == "relation");

            /* populate unordered list */
            resFilter.forEach(element => {
                addListElement(element, map);
            });
        })
        .catch(err => {
            console.log('Error fetching data', err);
        });


});

//! ----------------------------------------------------------------------------
//! old way to handle add selection height
// document.querySelectorAll("#addSelection .collapsible").forEach(ele => ele.addEventListener("click", function(){
    
//     let content = this.nextElementSibling.nextElementSibling;
//     let parent = content.parentElement.closest(".content");

//     this.classList.toggle("arrow-down");

//     /* this style.maxHeight = "value" will add on top of the base css "max-height: 0;"
//     Once it is removed the normal css "max-height: 0;" will apply */
//     if(content.style.maxHeight){
//         content.style.maxHeight = null;
//         while(parent){
//             parent.style.maxHeight = parent.scrollHeight - content.scrollHeight + "px";
//             parent = parent.parentElement.closest(".content");
//         }
//     }else{
//         content.style.maxHeight = content.scrollHeight + "px";
//         while(parent){
//             parent.style.maxHeight = parent.scrollHeight + content.scrollHeight + "px";
//             parent = parent.parentElement.closest(".content");
//         }
//     }
// }))
//! ----------------------------------------------------------------------------

// TODO: -----------------------------------------------------------------------
// TODO: make a jstree plugin to add button later, it is taking me too much time, use customMenu instead

// (function($, undefined){
//     "use strict";
//     $.jstree.defaults.dotsMenu = {
//         dotsMenu_option : "sample",
//     };
    
//     /* define the actual plugin */
//     $.jstree.plugins.dotsMenu = function(options, parent){

//         this.redraw_node = function(obj, deep, callback, force_draw){
//             obj = parent.redraw_node.call(this, obj, deep, callback, force_draw);

//             if(obj){
//                 var $button = $('<button class="custom-btn">Click Me</button>');
//                 $(obj).append($button);

//                 $button.on('click', function(event) {
//                     event.stopPropagation();
//                     console.log('Button clicked for node: ' + $(obj).attr('id'));
//                 });
//             }

//             return obj;
//         };
//     };
// })(jQuery);
// TODO: -----------------------------------------------------------------------



/* Make and handle jstree */
$("#addSelectionTree").jstree({
    "core": {
        'themes': {
            'icons': false
          },
        "dblclick_toggle": false,
        "check_callback": false
    },
    "plugins": ["checkbox", 'wholerow', "search", "contextmenu"],
    "checkbox": {
        "three_state": false,
        // "cascade": "down",
        "whole_node": false,
    },
    "search": {
        "show_only_matches": true
    },
    "contextmenu":{
        "items": function(node){
            return {
                "immediateChilds": {
                    "label": "select immediate childs",
                    /* obj is the button object */
                    "action": function(obj){
                        // console.log(node);
                        // console.log(obj);
                        /* select only immediate children */
                        node.children.forEach( child =>{
                            $(node).jstree("select_node", child, true);
                        });
                    }
                },
                "allChilds": {
                    "label": "select all childs",
                    "action": function(obj){
                        node.children_d.forEach( child =>{
                            $(node).jstree("select_node", child, true);
                        });
                    }
                }
            }
        }
    }
});


/* the search on input change was too slow, changed to search on enter */
$("#addSelectionFilter").on("keypress input", function(event){
    if (event.which == 13) {
        $("#addSelectionTree").jstree(true).search($(this).val());
    }

    if (event.type === 'input' && $(this).val() === '') {
        $("#addSelectionTree").jstree(true).search('');
    }
});

$("#addSelectionReset").on("click", function(){
    // $("#addSelectionFilter").val("").trigger("change").focus();
    $("#addSelectionTree").jstree(true).deselect_all();
})


$("#addSelectionPlot").on("click", function(e){
    let selected = $("#addSelectionTree").jstree(true).get_selected();
    selected.forEach((ele, index, arr)=>{
        arr[index] = ele.replace("osm-rel-","");
    });
    /* plot slippy map for selected relations */
    makeOSMIdsSlippyMap(selected, map);
})


//! -----------------------------------------------
//! old way of selection immediate childs
/* only the immediate children should be selected */
/* This uses cascade down checkbox */
// $("#addSelectionTree").on("select_node.jstree", function(e, data){

//     // console.log(data.node);
//     let children = data.node.children;
//     /* complement from all children */
//     let childrenDeselect = data.node.children_d.filter(x => !children.includes(x));
//     /* true, disable changed.jstree event */
//     childrenDeselect.forEach( child =>{
//         $(this).jstree("deselect_node", child, true);
//     });

// })
//! -----------------------------------------------


/* -------------------------------------------------------------------------- */
/* Handle download of selected tree */

/* make the popup menu show up */
$("#addSelectionDownloadPopupMenu").on("click", function(){
    $(".m-popup").toggleClass("show");
    $(".m-popup-background").toggleClass("show");
});

/* click outside to close menu */
$(".m-popup-background").on("click",function(){
    $(".m-popup").toggleClass("show");
    $(".m-popup-background").toggleClass("show");
})


/* make download feature */
async function popupMenuDownload(dlStruct, dlFormat, dlIncludeData){

    let jstreeData, osmRawResp, osmTagsIndex;

    /* display busy icon and hidden previous error */
    document.getElementById("m-pop-download-busyIcon").style.visibility = "visible";
    let errorMsg = document.getElementById("m-pop-download-error");
    if(errorMsg){
        document.getElementById("m-pop-download-footer").removeChild(errorMsg);
    };

    /* 
    Use only json to conserve structure, get_selected() doesn't keep the selected parents
    */
    jstreeData = $("#addSelectionTree").jstree(true).get_json();
    /* get only selected nodes */
    jstreeData = filterSelectedNodes(jstreeData);

    /* adds key "_parent" to conserve structure */
    jstreeData = flattenTree(jstreeData, "children_all_selected");
    
    /* form include data: simple/osm=tags/osm-geometry */
    if(dlIncludeData.id != "download-include-data-simple"){

        let selectedIDs = jstreeData.map(node => node.id.replace("osm-rel-",""));

        /* query osm tags */
        try{
            /* Check include osm-geometry was selected */
            osmRawResp = await getRelation(selectedIDs, (dlIncludeData.id == "download-include-data-osm-tags")? "tags" : "geom");
        }catch(error){
            document.getElementById("m-pop-download-busyIcon").style.visibility = "hidden";
            errorMsg = document.createElement("span");
            errorMsg.setAttribute("id", "m-pop-download-error")
            errorMsg.innerText = "Error fetching data!";
            errorMsg.style.color = "red";
            document.getElementById("m-pop-download-footer").appendChild(errorMsg);
            console.log(error);
            return;
        }
        /* make index of element tags */
        osmTagsIndex = makeOSMDataIndex(osmRawResp);

        /* create a property tags for each object */
        jstreeData.forEach(ele => {
            ele["tags"] = osmTagsIndex[ele.id].tags;
            ele["bounds"] = osmTagsIndex[ele.id].bounds;
            ele["members"] = osmTagsIndex[ele.id].members;
        });
        /* convert to geojson and get geometry key */
        if(dlIncludeData.id == "download-include-data-osm-geometry" && document.getElementById("geojson-geom-checkbox").checked){
            /* filter: select only relation */
            /* osmtogeojson modifies the original object, seems to be an issue with the paclet. Use a deep copy instead */
            let geojsonGeom = osmtogeojson(JSON.parse(JSON.stringify(osmRawResp))).features.filter(ele => ele.id.includes("relation"));
            let geojsonIndex = {};
            geojsonGeom.forEach(ele => {
                geojsonIndex[ele.id.replace('relation/','')] = ele.geometry;
            })
            jstreeData.forEach(ele => {
                ele["geometry"] = geojsonIndex[ele.id];
            });
        }
    }
    
    /* form selection: tree/nodes */
    if(dlStruct.id == "download-structure-tree"){
        /* rebuild tree using added "_parent" key */
        jstreeData = buildTree(jstreeData, "_parent");
    }else if(dlStruct.id == "download-structure-nodes"){
        jstreeData.forEach(x => delete x._parent);

    }

    let extension;
    /* form format: json/xml */
    if(dlFormat.id == "download-format-json"){
        jstreeData = JSON.stringify(jstreeData, null, 2);
        extension = "json";
    }else if(dlFormat.id == "download-format-xml"){
        jstreeData = mlib.json2xml(jstreeData, { compact: true, spaces: 4 });
        extension = "xml";
    }

    /* hide busy icon */
    document.getElementById("m-pop-download-busyIcon").style.visibility = "hidden";


    /* trigger anchor element to download */
    donwload(jstreeData, "add_selection." + extension, 'application/json')

};

// document.getElementById("download-include-data-osm-geometry").addEventListener("change", function(){
//     document.getElementById("geojson-geom-container").classList.toggle("osm-geom-geojson-checked");
// })

document.querySelectorAll("input[name='download-include-data']").forEach(function(elem){
    elem.addEventListener("change",function(){
        let temp = document.getElementById("download-include-data-osm-geometry");
        document.getElementById("geojson-geom-container").classList.toggle("osm-geom-geojson-checked", temp.checked);
        if(!temp.checked){
            document.getElementById("geojson-geom-checkbox").checked = false;
        }
    })
})

/* Give each element an specific format */
function formatNode(node){

    return (({id, text, parent, children, children_all_selected})=>({
        id: id.replace("osm-rel-",""),
        name: text.replace(/\n/gi, "").trim(),
        parent: parent.replace("osm-rel-",""),
        children: children.every(ele => typeof ele == "string")? children.map(id => id.replace("osm-rel-","")) : children,
        children_all_selected: children_all_selected
        })
    )(node);
}

/* Use recursive function to filter only selected elements */
function filterSelectedNodes(selectedArray, parentId ="#"){

    let filteredArray = [];
    let formattedElem;
    selectedArray.map(function(ele){
        if(ele.state.selected == true){
            formattedElem = formatNode({
                ...ele,
                parent: parentId,
                children: ele.children.map(child => child.id.replace("osm-rel-","")),
                children_all_selected: filterSelectedNodes(ele.children, ele.id)
            });
            filteredArray.push(formattedElem);
        }else{
            filteredArray = [...filteredArray, ...filterSelectedNodes(ele.children, ele.id)];
        }
    });

    return filteredArray;
}



/* handle the download with anchor element */
function donwload(content, filename, contentType){
    let a = document.createElement("a");
    let file = new Blob([content], {type: contentType});
    /* createObjectURL makes the file available in disk to use as href */
    a.href = URL.createObjectURL(file);
    a.download = filename;

    /* wait and then revoke the object */
    a.addEventListener("click", function(){
        setTimeout(()=>URL.revokeObjectURL(a.href), 200);
    });
    a.click();
}


/* handle form behaviour */
document.getElementById("form-download-structure").addEventListener("submit", handleSelectionDownload);

function handleSelectionDownload(event){
    event.preventDefault();
    let dlStruct = document.querySelector(".download-structure input:checked");
    let dlFormat = document.querySelector(".download-format input:checked");
    let dlIncludeData = document.querySelector(".download-include-data input:checked");

    popupMenuDownload(dlStruct, dlFormat, dlIncludeData);
}

/* -------------------------------------------------------------------------- */
