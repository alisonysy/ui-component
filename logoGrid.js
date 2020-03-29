/**
 * 
 * @param ulWrapperSelector(string) : the wrapper selector of the grid, e.g. ul.media-logos
 * @param gridCellSelector(string) : the grid cells (children) of the grid wrapper, default to '.m-item.thumb-ico' inside the media logo wrapper if not provided
 * @param opts(object) : 
 *        @param gridNumLimit(number) : the limit of the number of grids per row, defaults to 7;
 *        @param activeGridWidth(number) : the width of the active grid cell in percentage, defaults to 24;
 *        @param gridNumOnLeftSide(number) : how many grids are there per row on the left side, defaults to 3;
 *        @param gridNumOnRightSide(number) : how many grids are there per row on the right side, defaults to 3;
 * 
 */

function LogoGrid(ulWrapperSelector,gridCellSelector,opts){
  this.ulWrapper = document.querySelector(ulWrapperSelector);
  this.grids = gridCellSelector && gridCellSelector.length > 0 ? Array.prototype.slice.call(document.querySelectorAll(gridCellSelector)) : Array.prototype.slice.call(this.ulWrapper.querySelectorAll('.m-item.thumb-ico'));
  this.activeGrid = null; 
  this.opts = this.processOpts(opts);
  this._left = null;
  this._right = null;
  this.init();
}

LogoGrid.prototype.init = function(){
  this.activeGrid = this.findActiveGrid(this.grids);
  this._left = this.sectionState(this.grids,'left');
  this._right = this.sectionState(this.grids,'right');
  this.setWrapperStyle();
  this.setSectionStyle(this._left,1);
  this.setSectionStyle(this._right,this._left.columnNum+2);
  this.setActiveGridStyle(this.activeGrid.el,this._left.columnNum+1);
  this.bindClickEvent();
}

LogoGrid.prototype.findActiveGrid = function(grids){
  if(!grids) throw new Error('There are no grids, please check the provided selector.');
  let nonActiveNum=0;
  for(let n=0;n<grids.length;n++){
    if(grids[n].className.indexOf('active') !== -1){
      return {
        el:grids[n],
        index:n
      };
    }else{
      nonActiveNum++;
    }
    if(nonActiveNum === grids.length){
      return {
        el:grids[0],
        index:0
      }
    }
  }
}

LogoGrid.prototype.processOpts = function(opts){
  if(!opts) opts = {};
  let gridNumOnLeftSide = opts.gridNumOnLeftSide || 3;
  return {
    gridNumLimit: opts.gridNumLimit || 7,
    activeGridWidth:opts.activeGridWidth || 24,
    gridNumOnLeftSide: gridNumOnLeftSide,
    gridNumOnRightSide: opts.gridNumOnRightSide || gridNumOnLeftSide,
  }
}

LogoGrid.prototype.sectionState = function(totalGrids,section){
  let grids = Array.prototype.slice.call(totalGrids);
  let restCellNum = grids.length - 1;
  // delete the active grid before dividing grids into 2 sections;
  grids.splice(this.activeGrid.index,1);
  let totalCellNum, cellNumPerRow;
  totalCellNum = section === 'left'? 
                  Math.ceil(restCellNum/2) : 
                  section === 'right'?
                    Math.floor(restCellNum/2) :
                    null;
  if(!totalCellNum) throw new Error('A section must be provided.');
  cellNumPerRow = section === 'left'? this.opts.gridNumOnLeftSide : this.opts.gridNumOnRightSide;
  if(totalCellNum < cellNumPerRow){// when a user provides more grid cells than it actually needs
    cellNumPerRow = totalCellNum;
  }
  return {
    els: section === 'left'? grids.slice(0,totalCellNum) : grids.splice(Math.ceil(restCellNum/2),Math.floor(restCellNum/2)),
    totalCellNum: totalCellNum,
    cellNumPerRow: cellNumPerRow,
    columnNum : cellNumPerRow*(totalCellNum%cellNumPerRow) || cellNumPerRow,
    rowNum: Math.ceil(totalCellNum/cellNumPerRow)
  }
}

LogoGrid.prototype.setWrapperStyle = function(){
  let sectionWidth = (100 - this.opts.activeGridWidth)/2;
  let gridWrapperStyle = ';';
  // display:grid 
  gridWrapperStyle += this._prefix('display',this._prefixText(['ms',''],'grid'));
  // grid-template-rows: 100%; -ms-grid-rows:100%;
  let rowStyle = _repeat(this._left.rowNum,100/this._left.rowNum + '%');
  gridWrapperStyle += this._prefix(this._prefixText(['ms'],'grid-rows').concat(this._prefixText([''],'grid-template-rows')),rowStyle);
  // grid-template-columns: 
  let left = _repeat(this._left.columnNum,sectionWidth/this._left.columnNum+'%');
  let right = _repeat(this._right.columnNum,sectionWidth/this._right.columnNum+'%');
  let columnStyle = left + this.opts.activeGridWidth + '% '+right;
  gridWrapperStyle += this._prefix(this._prefixText(['ms'],'grid-columns').concat(this._prefixText([''],'grid-template-columns')),columnStyle);
  this.ulWrapper.style.cssText += gridWrapperStyle;
  function _repeat(times,repeatVal){
    let re ='';
    for(let n=0;n<times;n++){
      re += repeatVal + ' ';
    }
    return re;
  }
}

LogoGrid.prototype.setSectionStyle = function(section,startCol){
  // set style for normal grid cells
  let sectionRestCellNum = section.els.length % section.cellNumPerRow,
      normalGridCells = section.els.slice(0, section.els.length - sectionRestCellNum);
  let lastRowEnd, lastColEnd= startCol? startCol: 1;
  for(let n=0;n<normalGridCells.length;n++){
    let colSpan = section.columnNum/section.cellNumPerRow;
    lastRowEnd = Math.ceil((n+1)/section.cellNumPerRow);
    this.setGridCellStyle(normalGridCells[n],lastRowEnd,lastColEnd,lastRowEnd+1,lastColEnd+colSpan);
    lastColEnd = lastColEnd+colSpan;
    if(lastColEnd > (startCol + section.columnNum - 1)){// reset last column end for a new row;
      lastColEnd = startCol || 1;
    }
  };
  // set style for extra grid cells
  let extraGridCells = section.els.slice(normalGridCells.length);
  for(let i=0;i<extraGridCells.length;i++){
    let colSpan = section.columnNum/extraGridCells.length;
    lastRowEnd = Math.ceil((normalGridCells.length+i+1)/section.cellNumPerRow);
    this.setGridCellStyle(extraGridCells[i],lastRowEnd,lastColEnd,lastRowEnd+1,lastColEnd+colSpan);
    lastColEnd = lastColEnd+colSpan;
  }
}

LogoGrid.prototype.setGridCellStyle = function(el,rowStart,colStart,rowEnd,colEnd){
  let gridCellCssText = ';';
  // IE prefix first
  // -ms-grid-row and -ms-grid-row-span
  gridCellCssText += this._prefix(this._prefixText(['ms'],'grid-row'),rowStart);
  gridCellCssText += this._prefix(this._prefixText(['ms'],'grid-row-span'),rowEnd-rowStart);
  // -ms-grid-column and -ms-grid-column-span
  gridCellCssText += this._prefix(this._prefixText(['ms'],'grid-column'),colStart);
  gridCellCssText += this._prefix(this._prefixText(['ms'],'grid-column-span'), colEnd - colStart);
  // other browsers except IE using 'grid-area'
  gridCellCssText += this._prefix('grid-area',rowStart + '/' + colStart + '/' + rowEnd + '/' + colEnd);
  el.style.cssText += gridCellCssText;
}

LogoGrid.prototype.setActiveGridStyle = function(el,startCol,nonActiveEl){
  let tempStyle;
  if(nonActiveEl && nonActiveEl.nodeType === 1){// when a non-active grid cell is clicked
    // copy non-active grid cell style, only copy cssText?
    tempStyle = el.style.cssText;
    nonActiveEl.style.cssText = tempStyle;
  }
  this.setGridCellStyle(el,1,startCol,this._left.rowNum+1,startCol+1);
}

LogoGrid.prototype.bindClickEvent = function(){
  const self = this;
  this.ulWrapper.addEventListener('click',function(e){
    // e.target could be li or img
    let clicked = e.target;
    clicked = clicked.tagName.toLowerCase() === 'li'? clicked : clicked.tagName.toLowerCase() === 'img'? clicked.parentElement : null;
    if(!clicked) throw new Error('Cannot find clicked grid target.');
    self.setActiveGridStyle(clicked,self._left.columnNum+1,self.activeGrid.el);
    self.activeGrid = self.findActiveGrid(self.grids);
  },false);
}


LogoGrid.prototype._prefixText = function(vendors,prefixVal){
  return vendors.map(function(v){
    switch(v){
      case 'ms':
        v = '-ms-';
        break;
      case 'webkit':
        v = '-webkit-';
        break;
      case 'moz':
        v = '-moz-';
        break;
      case 'o':
        v = '-o-';
        break;
      default:
        v='';
        break;
    }
    return v+prefixVal;
  })
}

LogoGrid.prototype._prefix = function(prop,val){
  function _isArray(v){
    return Object.prototype.toString.call(v)==='[object Array]';
  }
  if(_isArray(prop) && !_isArray(val)){
    return prop.reduce(function(prev,cur){
      return prev + cur + ':' + val + ';';
    },'')
  }else if(!_isArray(prop) && _isArray(val)){
    return val.reduce(function(prev,cur){
      return prev + prop + ':' + cur + ';';
    },'')
  }else if(!_isArray(prop) && !_isArray(val)){
    return prop + ':' + val + ';';
  }
}
