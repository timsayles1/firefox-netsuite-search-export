/*
*
* This script is injected into the site from content.js in order to access
* components of the DOM and specific NetSuite functions
*
*/

"use strict"

var ssSettings;
var ssSearchType = undefined;
var ssRecType = -1;
var ssSearchId = undefined;

// Initialize search export once form is fully loaded by NetSuite
NS.event.once(
    NS.event.type.FORM_INITED,
    initializeSearchExport()
);

function initializeSearchExport() {
	ssSearchType = document.getElementById("searchtype")?.value || NS.Core.getURLParameter('searchtype');
    ssRecType = document.getElementById("rectype")?.value  || NS.Core.getURLParameter('rectype') || -1;
	ssSearchId = document.getElementById("id")?.value  || NS.Core.getURLParameter('id') || -1;
	execute();
}

function execute() {
	try{
		if(!ssSearchId){
			jQuery(".page-title-menu>.ns-menu").append('<li class="ns-menuitem ns-header">'+
			'<a id="eportsearchtoscript" href="#">Search Export - Save Required</a></li>');
			jQuery('#eportsearchtoscript').click(function(){
				jQuery('body').append('<div id="searchcode">'+
					'<p>This tool requires the search to be saved in order to export.<br><br>Please save the search before continuing.</p><br>'+
					"<p>You can always delete the search if you don't need it after exporting.</p><br>"+
					'</div>');
				jQuery('#searchcode').dialog({
					width: 500,
					height: 350,
					closeText: "",
					position: { my: "right top", at: "right bottom", of: jQuery(this) }
				});
			});
			return;
		}
		var type = null;
		nsapiCheckArgs( [ssSearchId], ['id'], 'nlapiLoadSearch' );
	    ssSearchId = ssSearchId != null && !isNaN(parseInt( ssSearchId )) ? parseInt( ssSearchId ) : ssSearchId != null ? ssSearchId : null;
		try{
			var search = new nlobjSearch(type, ssSearchId, null, null);
			search._load();
		} catch (load_error) {
			var search = new nlobjSearch(ssSearchType, ssSearchId, null, null);
			search._load();
		}
	} catch(err){
		jQuery(".page-title-menu>.ns-menu").append('<li class="ns-menuitem ns-header">'+
		'<a id="eportsearchtoscript" href="#">Export as Script Not Supported</a></li>');
		jQuery('#eportsearchtoscript').click(function(){
			jQuery('body').append('<div id="searchcode">'+
			'<p>This search type is not supported by SuiteScript.<br><br>Please refer to this page in SuiteAnswers for more information.</p><br>'+
			'<a href="https://netsuite.custhelp.com/app/answers/detail/a_id/10242" target="_blank">SuiteScript Supported Records</a>'+
			'</div>');
			jQuery('#searchcode').dialog({
				width: 500,
				height: 350,
				closeText: "",
				position: { my: "right top", at: "right bottom", of: jQuery(this) }
			});
		});
		return;
	};
	
	//Main script execution
	jQuery(".page-title-menu>.ns-menu").append('<li class="ns-menuitem ns-header">'+
	'<a id="eportsearchtoscript" href="#">Export as Script</a></li>');
	jQuery('#eportsearchtoscript').click(function(event){
		event.preventDefault();
		buildUI(false, search);
	});
}

function buildUI(hideLabels, search){
	hideLabels = hideLabels===true ? hideLabels : false;
	jQuery('#searchcode_container').remove();
	var searchtype = search.getSearchType();
	var searchcode1 = 'var '+searchtype+'Search = nlapiSearchRecord("'+searchtype+'",null,\n';
	var sf=search.getFilterExpression();
	var filterExpr = "[\n";
	for(var f=0;f<sf.length;f++){
		filterExpr += "   "+JSON.stringify(sf[f]);
		filterExpr+=", \n";
	}
	filterExpr = filterExpr.substring(0,filterExpr.lastIndexOf(','));
	if(filterExpr.length==0) filterExpr = "[";
	searchcode1 += filterExpr+"\n], \n";
	var colObjAry = search.getColumns();
	var colstr = "[\n";
	var colstr2 = "[\n";
	for(var co=0;co<colObjAry.length;co++){
		var c=colObjAry[co];
		if(c.formula) c.formula = c.formula.replace(/\"/g,'&#92;"');
		colstr += '   new nlobjSearchColumn("'+c.name+'",';
		colstr += (c.join ? '"'+c.join+'",' : "null,");
		colstr += (c.summary ? '"'+c.summary+'"' : "null");
		if(c.formula) colstr += ').setFormula("'+c.formula+'")';
		if(c.sortdir) colstr += (c.formula ? '':')')+'.setSort('+(c.sortdir=='DESC')+')';
		if(!c.formula && !c.sortdir)colstr+=')';
		colstr = colstr.replace(',null,null)',')');
		if(co<colObjAry.length-1) colstr+=", \n";
		if(!c.formula && !c.join && !c.summary && !c.sortdir){
			if(c.label && !hideLabels){
				colstr2 += '      search.createColumn({name: "'+
				c.name+'", label: "'+c.label+'"}),\n';
			} else {
				colstr2 += '      "'+c.name+'",\n';
			}
			continue;
		}
		colstr2 += '      search.createColumn({\n'+
		'         name: "'+c.name+'",\n';
		colstr2 += (c.join ? '         join: "'+c.join+'",\n' : "");
		colstr2 += (c.summary ? '         summary: "'+c.summary+'",\n' : "");
		colstr2 += (c.formula ? '         formula: "'+c.formula+'",\n' : "");
		colstr2 += (c.sortdir ? '         sort: search.Sort.'+(c.sortdir)+',\n' : "");
		if(!hideLabels) colstr2 += (c.label ? '         label: "'+c.label+'",\n' : "");
		colstr2 = colstr2.substring(0,colstr2.lastIndexOf(','));
		colstr2 += '\n      }),\n';
	}
	colstr2 = colstr2.substring(0,colstr2.lastIndexOf(',')) + "\n   ]\n";
	colstr += "\n]\n";
	searchcode1 += colstr+");";
	filterExpr = filterExpr.replace(/   /g,"      ");
	if(filterExpr.length==0) filterExpr = "[";
	filterExpr = filterExpr+="\n   ],";
	var searchcode2 = 'var '+searchtype+'SearchObj = search.create({\n   type: "'+searchtype+'",\n'+
		(search.settings ? '   settings:'+JSON.stringify(search.settings)+',' : '')+
	'   filters:\n   '+filterExpr+"\n"+
	'   columns:\n   '+colstr2+'});\n'+
	'var searchResultCount = '+searchtype+'SearchObj.runPaged().count;\n'+
	'log.debug("'+searchtype+'SearchObj result count",searchResultCount);\n'+
	searchtype+'SearchObj.run().each(function(result){\n   // .run().each has a limit of 4,000 results\n'+
	'   return true;\n});'
		+'\n\n'
		+'/*\n'+searchtype+'SearchObj.id="customsearch'+Date.now()+'";\n'
		+searchtype+'SearchObj.title="'+nlapiGetFieldValue('searchtitle')+' (copy)";\n'
		+'var newSearchId = '+searchtype+'SearchObj.save();\n*/'
	;
	var searchcode2console = 'require([\'N\'], function(N) {\n' +
	'for(var n in N){window[n] = N[n];};\n' +
	'try{\n' +
	'    \n' +
	'var s=search.load({id:"'+id+'",type:"'+searchtype+'"});\n' +
	'console.log(s.toJSON());\n' +
	'console.log(s.runPaged().count);\n' +
	's.run().each(function(r){\n' +
	'   console.log(r.toJSON());\n' +
	'   return true;\n' +
	'});\n' +
	'\n' +
	'} catch(e){console.error(e.message);}})'
	;
		
	jQuery('body').append('<div id="searchcode_container">'+
	'<style>.h2{display: inline; margin-right: 25px;} .prettyprint{border:1px solid; padding:5px; overflow-x: auto;}</style>'+
	'<h2 class="h2">SS2.X</h2><button id="ss2copy">Copy</button> <input id="ss2labels" type="checkbox" '+(hideLabels ? 'checked' : '')+'>'+
	'<label for="ss2labels"> No Labels</label><span><pre id="ss2" class="prettyprint"></pre></span>'+
	'<p>&nbsp</p><p>&nbsp</p>'+
	'<h2 class="h2">SS2.X Run in Console</h2><button id="ss2consolecopy">Copy</button><span><pre id="ss2c" class="prettyprint"></pre></span>'+
	'<p>&nbsp</p><p>&nbsp</p>'+
	'<h2 class="h2">SS1.0</h2><button id="ss1copy">Copy</button><span><pre id="ss1" class="prettyprint"></pre></span>'+
	'<p>&nbsp</p><p>&nbsp</p>'+
	'</div>');
	jQuery('#ss1').text(searchcode1.replace(/&#92;/g,'\\'));
	jQuery('#ss2').text(searchcode2.replace(/&#92;/g,'\\'));
	jQuery('#ss2c').text(searchcode2console.replace(/&#92;/g,'\\'));
	jQuery('#ss1copy').click(function(){copyCode('#ss1');});
	jQuery('#ss2copy').click(function(){copyCode('#ss2');});
	jQuery('#ss2consolecopy').click(function(){copyCode('#ss2c');});
	jQuery('#ss2labels').change(function(){
		buildUI(jQuery(this).is(":checked"));
	});
	jQuery('#searchcode_container').dialog({
		title: "Saved Search Code",
		width: 615,
		height: 600,
		closeText: "",
		position: { my: "right top", at: "right bottom", of: jQuery('#eportsearchtoscript') }
	});
}

function get(url, callback) {
	var x = new XMLHttpRequest();
	x.onload = x.onerror = function() { callback(x.responseText); };
	x.open('GET', url);
	x.send();
}
			
function copyCode(fieldId){ 
	var searchStr = jQuery(fieldId).text();
	jQuery('body').append('<textarea id="copyfieldid" />');
	jQuery('#copyfieldid').text(searchStr);
	var inp = document.querySelector('#copyfieldid');
	if (inp && inp.select) {
		inp.select();
		try {
			document.execCommand('copy');
			jQuery(fieldId).parent().prepend('<div id="copiednotice" style="text-align:center; color: #fff;background-color: #22a;border-radius: 3px;">Code Copied</div>');
			jQuery('#copiednotice').animate({
				opacity: 0.25
			}, 2000, function() {
				this.remove();
			});
		}
		catch (err) {
			alert('Please use Ctrl/Cmd+C to copy');
		}
	}
	jQuery('#copyfieldid').remove();
}