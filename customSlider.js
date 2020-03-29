/**
 * 1. when copying all children inside an element, don't forget text nodes;
 * 2. should first create all children with attributes needed, and then create the element(parent) itself
 * 3. to copy text nodes, should use 'createTextNode(t)' instead of directly manipulating the text node itself
 * @param {*} id(string)
 * @param {*} isAuto(boolean)
 * @param {*} options(object)
 *    offsetWidth(number): the width in pixel of the slider
 *    slideWrapper(string): if not provided, default to the child element <ul> 
 *    slideSelector(string): if not provided, default to the child <li> of the slideWrapper
 *    interval(number): how long each slide pauses before switching to the next, only effective when auto mode is on
 *    restartInterval(number): how long it will automatically switch to the next slide after a user manually clicks to the previous or next slide
 *    indicator(boolean): whether the buttons(indicators) are shown
 *    indicatorSettings(object): {
 *		  wrapperClass(string): the class name of the wrapper element of indicators
 *	  }
 *    previousButton(string): the selector of the previous button of the slide, provided as specific as possible
 *    nextButton(string): the selector of the next button of the slide
 *    initSwiper(boolean): if enabled, a user can swipe to next/previous slide
 *    swiperSettings(object): {
 *      xSensitivity(number): the least ratio of the horizontal distance a user swipes and the screen width, if a user swipes for a distance horizontally smaller than the ratio, it stays at the same slide
 *      ySensitivity(number): the largest ratio of the vertical distance a user swipes and the screen height, if a user swipes for a distance vertically larger than the ratio, the swiper stays unchanged as it assumes the user tries to scroll vertically
 *      isForMediaSection(boolean): if the slider is for the media section, and if true, this will set the logo display for mobiles
 *      logoSelector(string): required if [isForMediaSection] is set to true, it should be the selector of media logos, default to '.product-media .media-logos .m-item'
 *      activeLogoWidth(number): the width of the active logo in percentage
 *    }
 *    
 *    
 */
function CustomSlider(id,isAuto,options={}){
  this._id = id;
  this._isAuto = isAuto;
  this.options = options;
  this._timerId = undefined;
  this._timeOutIds = [];
  this._slide_wrapper = document.querySelector(options.slideWrapper) || document.querySelector(`#${this._id} > ul`);
  this._childrenCount = undefined;
  this._index = undefined;
  this._offsetWidth = options.offsetWidth || document.getElementById(this._id).clientWidth;
  this._timeout = 800;

  this._swiperSettings = {
    xSensitivity: options.swiperSettings? options.swiperSettings.xSensitivity || 0.5 : 0.5,
    ySensitivity: options.swiperSettings? options.swiperSettings.ySensitivity || 0.1 : 0.1,
    isForMediaSection: options.swiperSettings? options.swiperSettings.isForMediaSection || false : false,
    activeLogoWidth: options.swiperSettings? options.swiperSettings.activeLogoWidth || 28 : 0
  };
  this._isSwiping = false;

  this._registeredEvents = {};
  this._mediaLogosSelector = this._swiperSettings.isForMediaSection? 
                              options.swiperSettings.logoSelector?
                                options.swiperSettings.logoSelector
                                : '.product-media .media-logos .m-item'
                                : null;
}

CustomSlider.prototype.init = function(){
  // copy the first and last children;
  let allLis;
  if(this.options.slideSelector){
    allLis = document.querySelectorAll(this.options.slideSelector);
    if(!allLis) console.warn('There is no child element under the slider.');
  }else{
    allLis = this.options.slideWrapper ? document.querySelectorAll(this.options.slideWrapper + ' > *') : document.querySelectorAll('#'+this._id+' > ul > *');
  }
  let firstCopied =this.copySlide(allLis[0]);
  let lastCopied = this.copySlide(allLis[allLis.length-1]);
  // insert the copies to wrapper;
  this.insertTo(this._slide_wrapper,lastCopied,'afterbegin');
  this.insertTo(this._slide_wrapper,firstCopied,'beforeend');
  // set wrapper's width equal to the sum of its children's width
  this._childrenCount = this._slide_wrapper.childElementCount;
  this.setWidth();
  // calculate current index and width;
  this._index = 0; // the current second child 
  this.bindEvents();
  // console.log(firstCopied,lastCopied,'child',this._childrenCount);
  if(this.options.indicator){
    this.createIndicator();
  }
}

CustomSlider.prototype.setWidth = function(){
  let children = this._slide_wrapper.children;
  // this._slide_wrapper.style.width = this._childrenCount*100 + '%'; 
  this._slide_wrapper.style.setProperty('width', this._childrenCount*100 + '%', 'important');
  for(let n=0;n<this._childrenCount;n++){
    children[n].style.width = 100 / this._childrenCount + '%';
    children[n].style.display = 'inline-block';
  };
}

CustomSlider.prototype.bindEvents = function(){
  // need to know the current index, after translating, add up current index
  // if do not provide offset to translate in @options, then default to the width of the wrapper's direct children
  let prevBtn = document.getElementById(this._id).querySelector(this.options.previousButton || '.prev_btn'),
      nextBtn = document.getElementById(this._id).querySelector(this.options.nextButton || '.next_btn');
  const self = this;
  if(!prevBtn || !nextBtn){
    // touch event not emitted by desktop Chrome
    this.bindSwipeEvents();
    console.warn('Please provide button elements.');
  }
  // bind click events
  prevBtn.addEventListener('click',function(e){
    self._clearTimeOuts();
    self._translate(false,true);
    if(self._index===0){
      self._index = self._childrenCount - 2;
      self.setIndicatorClass();
      self.swapSameSlide();
    }
    self._restartSlide();
  });
  nextBtn.addEventListener('click',function(){
    self._clearTimeOuts();
    self._translate(true,true);
    if(self._index===self._childrenCount-1){
      self._index=1;
      self.setIndicatorClass();
      self.swapSameSlide();
    }
    self._restartSlide();
  });
  if(this.options.initSwiper){
    this.bindSwipeEvents();
  }
  this._translate(true,false);
  if(this._isAuto){
    this.autoSlide();
  }
}

CustomSlider.prototype.bindSwipeEvents = function(){
  const self = this;
  this._clearTimeOuts();
  // use pointer event for desktop browsers, as a fallback to browsers that do not support touch events
  let vp = this._slide_wrapper;
  if(window.TouchEvent){
    this.bindTouchEvents(vp);
  }else{
    // #toDo
    this.bindPointerEvents(vp);
  };
  if(this._swiperSettings.isForMediaSection){
    this.bindLogoClickEvent(this._mediaLogosSelector);
    this.subscribe('translate',function(){
      let activeLogoId = +self._slide_wrapper.querySelector('.active').getAttribute('id').slice(1) - 1;
      self.setLogoMobileDisplay(activeLogoId,self._mediaLogosSelector);
    });
  }
}

CustomSlider.prototype.bindTouchEvents = function(container){
  const self = this;
  let startX, startY,startTime,swipeTime;
  let swipeYLimit = this._swiperSettings.ySensitivity * window.innerHeight,
      swipeXBase = this._swiperSettings.xSensitivity * window.innerWidth;
  let currentTranslate;
  // when touchmove event is happening but touchend has not been fired, translate the same distance as the touch moves
  container.addEventListener('touchstart',function(e){
    self._clearTimeOuts();
    if(self._isSwiping && !_isTouchObj(e.touches[0])) return;
    const touch = e.touches[0];
    self._isSwiping = true;
    startTime = +new Date();
    startX = touch.pageX;
    startY = touch.pageY;
    currentTranslate = parseFloat(self._slide_wrapper.style.transform.slice(self._slide_wrapper.style.transform.indexOf('(')+1))
  },false);
  container.addEventListener('touchmove',function(e){
    if(!self._isSwiping && !_isTouchObj(e.touches[0])) return;
    const touch = e.touches[0];
    let deltaX = touch.pageX - startX, deltaY = touch.pageY - startY, translateX;
    if(Math.abs(deltaY)>swipeYLimit){ // assumes a user scrolls
      self._isSwiping = false;
      return;
    }else{
      if(e.cancelable){
        e.preventDefault();
      }else{
        return;
      }
    };
    self._slide_wrapper.style.transition = 'all '+ 0.8 +'s';
    translateX = Math.abs(deltaX) > self._offsetWidth? currentTranslate : (currentTranslate + deltaX);
    self._slide_wrapper.style.transform = "translateX(" + (translateX) + "px)";
  });
  container.addEventListener('touchend',function(e){
    if(!self._isSwiping && !_isTouchObj(e.changedTouches[0])) return;
    const touch = e.changedTouches[0];
    let deltaX = touch.pageX - startX, deltaY = touch.pageY - startY;
    if(!self._isSwiping || Math.abs(deltaY)>swipeYLimit){
      return;
    }else{
      e.preventDefault();
    };
    swipeTime = +new Date() - startTime;
    self._slide_wrapper.style.transition = 'all '+ 0.8 +'s';
    if(Math.abs(deltaX)<swipeXBase && swipeTime > 300){ 
      // translate the current slide but not to the next slide, and back to the current slide
      self._slide_wrapper.style.transform = "translateX(" + currentTranslate + "px)";
    }else{
      if(deltaX > 0){// swipe from left to right, to previous slide
        self._translate(false,true);
        if(self._index===0){
          self._index = self._childrenCount - 2;
          self.swapSameSlide();
        }
      }else{// swipe from right to left, to next slide
        self._translate(true,true);
        if(self._index===self._childrenCount-1){
          self._index=1;
          self.swapSameSlide();
        }
      }
    };
    self._restartSlide();
  });
  container.addEventListener('touchcancel',function(e){
    self._slide_wrapper.style.transform = "translateX(" + currentTranslate + "px)";
    self._restartSlide();
  });
  function _isTouchObj(obj){
    return obj? true : false;
  }
}

CustomSlider.prototype.swapSameSlide = function(){
  const self = this;
  this._timeOutIds.push(setTimeout(function(){
    self._translate(undefined,false);
  }, self._timeout));
}

CustomSlider.prototype.bindPointerEvents = function(container){
  container.addEventListener('pointerdown',function(e){
    console.log('-----pointer down---',e)
  });
  container.addEventListener('pointermove',function(e){
    // continuously fired on safari with the pointer hovering - if the pointerType === 'mouse' return;
    if(e.pointerType === 'mouse') return;
    console.log('---pointer move----------',e)
  });
  container.addEventListener('pointerup',function(e){
    console.log('-----will pointerup be fired on safari',e);
  })
}

CustomSlider.prototype._restartSlide = function(){
  const self = this;
  if(this._isAuto){
    this._timeOutIds.push(setTimeout(function(){
      self.autoSlide();
    }, this.options.restartInterval || 800));
  }
}

CustomSlider.prototype.autoSlide = function(){
  const self = this;
  this._clearTimeOuts();
  this._timerId = setInterval(function(){
    self._translate(true,true);
    if(self._index===self._childrenCount-1){
      self._index=1;
      self.setIndicatorClass();
      self._timeOutIds.push(setTimeout(function(){
        self._translate(undefined,false);
      }, self._timeout));
    }
  }, self.options.interval || 2000);
}

CustomSlider.prototype._translate = function(isNext,needTransition){
  //this._resetWidth();
  if(isNext){
    this._index++;
  }else if(!isNext && isNext !== undefined){
    this._index--;
  }
  let transition = this._timeout / 1000;
  this._slide_wrapper.style.transition = needTransition ? ('all '+ transition +'s'): 'none';
  this._slide_wrapper.style.transform = "translateX(" + (-this._index*this._offsetWidth) + "px)";
  if(this.options.indicator){
    this.setIndicatorClass();
  };
  if(this.initSwiper){
    this._isSwiping = false;
  };
  this.setSlideClass(this._index);
  this.emitEvent('translate');
};

CustomSlider.prototype.emitEvent = function(evt){
  if(this._registeredEvents[evt] && this._registeredEvents[evt].length > 0){
    this._registeredEvents[evt].map(function(listener){
      if(typeof listener !== 'function') return;
      listener.call();
    })
  }
};

CustomSlider.prototype.subscribe = function(evt,cb){
  if(this._registeredEvents[evt]){
    this._registeredEvents[evt].push(cb);
  }else{
    this._registeredEvents[evt] = [];
    this._registeredEvents[evt].push(cb);
  }
};

CustomSlider.prototype.setLogoMobileDisplay = function(activeLogoId,logosSelector){
  let allLogos = Array.prototype.slice.call(document.querySelectorAll(logosSelector) || []);
  if(!allLogos.length) return;
  let currentActiveLogo = document.querySelector(logosSelector.trim()+'.active') || allLogos[0];
  let activeLogoWid = this._swiperSettings.activeLogoWidth;
  if(!activeLogoWid){console.warn('The width of active logo is 0, please check.')}
  let toShowLogos = [];
  currentActiveLogo.classList.remove('active');
  allLogos[activeLogoId].classList.add('active');
  if(allLogos.length >= 5){
    if(activeLogoId -2 < 0){
      toShowLogos = allLogos.slice(activeLogoId-2).concat(allLogos.slice(0,activeLogoId+3));
    }else if(activeLogoId+3>allLogos.length){
      toShowLogos = allLogos.slice(activeLogoId-2).concat(allLogos.slice(0,activeLogoId+3-allLogos.length));
    }else{
      toShowLogos = allLogos.slice(activeLogoId-2,activeLogoId+3);
    }
    for(let n = 0;n<allLogos.length;n++){
      allLogos[n].style.display = 'none';
      allLogos[n].style.order = '';
      toShowLogos.map(function(l,idx){
        if(allLogos[n].getAttribute('id') === l.getAttribute('id')){
          l.style.display = 'flex';
          l.style.width = (100 - activeLogoWid)/4 + '%';
          l.style.order = idx;
        };
      });
    };
    allLogos[activeLogoId].style.width = activeLogoWid+'%';
  }else{
    allLogos.map(function(l){
      l.style.width = 100/allLogos.length + '%';
    });
  }
};

CustomSlider.prototype.bindLogoClickEvent = function(logosSelector){
  const self = this;
  let allLogos = Array.prototype.slice.call(document.querySelectorAll(logosSelector));
  allLogos.map(function(l){
    l.addEventListener('click',function(e){
      self._clearTimeOuts();
      self._index = +e.currentTarget.getAttribute('id').slice(1);
      self._translate(undefined,true);
    })
  })
}

CustomSlider.prototype.setSlideClass = function(index){
  let lastActiveItem = this._slide_wrapper.querySelector('.active') || this._slide_wrapper.children[0];
  if(!lastActiveItem) return;
  let allItems = Array.prototype.slice.call(this._slide_wrapper.children);
  lastActiveItem.classList.remove('active');
  allItems[index].classList.add('active');
}

CustomSlider.prototype.copySlide = function(el){
  const self = this;
  let elChildNd = el.childNodes,newChildNd=[];
  if(elChildNd.length){
    for(let c=0;c<elChildNd.length;c++){
      if(elChildNd[c].nodeType===3 && elChildNd[c].wholeText.trim().length){//a textnode
        let txt = elChildNd[c].wholeText;
        newChildNd.push(document.createTextNode(txt));
      }else if(elChildNd[c].nodeType===1){
        let copiedEl = self.copySlide(elChildNd[c])
        newChildNd.push(copiedEl);
      }
    }
  }
  let newEl = document.createElement(el.tagName.toLowerCase());
  let elAttrNameArr = el.getAttributeNames();
  for(let a=0;a<elAttrNameArr.length;a++){
    let attrVal = el.getAttribute(elAttrNameArr[a]);
    newEl.setAttribute(elAttrNameArr[a],attrVal);
  }
  newChildNd.map(function(i){return newEl.appendChild(i)});
  return newEl;
}

CustomSlider.prototype.insertTo = function(target,elToInsert,position){
  target.insertAdjacentElement(position,elToInsert);
  if(position==='afterbegin' || position==='beforeend'){
    return target;
  }else{
    return target.parentElement;
  }
}

CustomSlider.prototype.createIndicator = function(){
  const self = this;
  let wrapper = document.createElement('div');
  let settings = this.options.indicatorSettings || {};
  wrapper.setAttribute('class', settings.wrapperClass || 'circle_btn');
  for(let i=0;i<this._childrenCount-2;i++){
    wrapper.appendChild(document.createElement('button'));
  }
  this._slide_wrapper.parentElement.appendChild(wrapper);
  let circles = wrapper.querySelectorAll('button');
  this.setIndicatorClass(circles);
  for(let n=0;n<circles.length;n++){
    circles[n].addEventListener('click',function(){
      self._clearTimeOuts();
      self._index = n+1;
      self._translate(undefined,true);
      self._restartSlide();
    })
  }
}

CustomSlider.prototype.setIndicatorClass = function(){
  if(!this.options.indicator)return;
  let settings = this.options.indicatorSettings || {},
      wrapperClass = settings.wrapperClass || 'circle_btn';
  let circles = this._slide_wrapper.parentElement.querySelectorAll('.'+wrapperClass+' button');
  for(let n=0;n<circles.length;n++){
    circles[n].classList.remove('active');
    if(this._index===n+1){
      circles[n].classList.add('active');
    }
  }

}

CustomSlider.prototype._clearTimeOuts = function(){
  if(this._timerId || this._timeOutIds.length > 0){
    window.clearInterval(this._timerId);
    this._timeOutIds.map(function(i){window.clearTimeout(i)});
    this._timerId = undefined;
    this._timeOutIds = [];
  }
}

CustomSlider.prototype._resetWidth = function(){
  if(this._offsetWidth) return;
  this._offsetWidth = this.options.offsetWidth || document.getElementById(this._id).clientWidth;
}
