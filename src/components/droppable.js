import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {subscribe, unsubscribe} from '../util/event_manager';
import VirtualizedScrollBar from './virtualized-scrollbar';
import Util from './../util/util';
import DynamicVirtualizedScrollbar from './dynamic-virtualized-scrollbar';

class Droppable extends Component {
	constructor(props) {
		super(props);
		this.state = {
			placeholder: null,
			scrollOffset: 0,
			topSpacerHeight: 0,
			unrenderedBelow: 0,
			unrenderedAbove: 0,
			dragAndDropGroup: Util.getDragEvents(this.props.dragAndDropGroup),
			currentlyActiveDraggable: null
		};
		this.onPlaceholderChange = this.onPlaceholderChange.bind(this);
		this.onScrollChange = this.onScrollChange.bind(this);
		this.onDragEnd = this.onDragEnd.bind(this);
		this.onDragStart = this.onDragStart.bind(this);
		this.getDraggedElemHeight = this.getDraggedElemHeight.bind(this);
		this.defaultElemHeight = 50;
		//this.getShouldAlwaysRender = this.getShouldAlwaysRender.bind(this);
	}

	componentDidMount() {
		subscribe(this.state.dragAndDropGroup.placeholderEvent, this.onPlaceholderChange);
		subscribe(this.state.dragAndDropGroup.scrollEvent, this.onScrollChange);
		subscribe(this.state.dragAndDropGroup.endEvent, this.onDragEnd);
		subscribe(this.state.dragAndDropGroup.startEvent, this.onDragStart);
		this.setState({mounted: true});
	}

	componentWillUnmount() {
		unsubscribe(this.state.dragAndDropGroup.endEvent, this.onDragEnd);
		unsubscribe(this.state.dragAndDropGroup.startEvent, this.onDragStart);
		unsubscribe(this.state.dragAndDropGroup.placeholderEvent, this.onPlaceholderChange);
		unsubscribe(this.state.dragAndDropGroup.scrollEvent, this.onScrollChange);
	}

	getScrollTop() {
		if (this.scrollBars) {
			return this.scrollBars.getScrollTop();
		}
	}

	animateScrollTop(val) {
		if (this.scrollBars) {
			this.scrollBars.animateScrollTop(val);
		}
	}

	scrollTop(val) {
		if (this.scrollBars) {
			this.scrollBars.scrollTop(val);
		}
	}

	getScrollHeight() {
		if (this.scrollBars) {
			return this.scrollBars.getScrollHeight();
		}
	}

	onDragEnd(draggedElem) {
		this.setState({currentlyActiveDraggable: null}, () => this.forceUpdate());
	}

	onDragStart(draggedElem) {
		this.setState({currentlyActiveDraggable: draggedElem});
	}

	// Receives notification about placeholder from context. If we're not the active droppable, don't show placeholder.
	onPlaceholderChange(placeholder, droppableActive) {
		const isTargetingMe = droppableActive === this.props.droppableId;
		if (isTargetingMe) {
			this.setState({placeholder: placeholder, droppableActive: droppableActive});
		} else if (this.state.placeholder != null || this.state.droppableActive !== null) {
			this.setState({placeholder: null, droppableActive: null});
		}
	}

	shouldComponentUpdate(nextProps, nextState) {
		// If we're not in a drag, and one is not coming up, always update
		if (this.state.currentlyActiveDraggable == null && this.state.droppableActive == null && nextState.droppableActive == null && nextState.currentlyActiveDraggable == null) {
			return true;
		}
		if (this.state.mounted !== nextState.mounted) {
			return true;
		}
		if (this.state.scrollOffset !== nextState.scrollOffset) {
			return true;
		}
		if (this.props.children && nextProps.children && this.props.children.length !== nextProps.children.length) {
			return true;
		}
		const isTargetingMe = nextState.droppableActive === this.props.droppableId;
		if (isTargetingMe) {
			if (this.state.droppableActive === nextState.droppableActive && this.state.placeholder === nextState.placeholder) {
				return false;
			}
		} else if (this.state.placeholder == null && this.state.droppableActive == null) {
			//If we're not being targeted, we dont' want a placeholder update.
			return false;
		}
		return true;
	}

	getDraggedElemHeight() {
		if (this.state.currentlyActiveDraggable) {
			return this.state.currentlyActiveDraggable.height;
		}
		return this.props.elemHeight ? this.props.elemHeight : this.defaultElemHeight;
	}

	pushPlaceholder(children) {
		let pushedPlaceholder = false;
		const listToRender = [...children];
		const placeholderHeight = this.props.dynamicElemHeight ? this.getDraggedElemHeight() : this.props.elemHeight ? this.props.elemHeight : this.defaultElemHeight;
		let style;

		if (this.props.placeholderStyle) {
			style = {...this.props.placeholderStyle};
			style.height = placeholderHeight;
		} else {
			style = {
				border: '1px dashed grey',
				height: placeholderHeight,
				backgroundColor: 'transparent'
			};
		}

		if (this.state.placeholder) {
			listToRender.forEach((elem, index) => {
				if (elem && elem.props && elem.props.draggableId === this.state.placeholder && !pushedPlaceholder) {
					listToRender.splice(
						index,
						0,
						<div key={'placeholder'} draggableid={'placeholder'} className={'draggable-test'} style={style}>
							<p className={'placeholder-text'} />
						</div>
					);
					pushedPlaceholder = true;
				}
			});
		} else if (!pushedPlaceholder) {
			listToRender.push(
				<div key={'placeholder'} draggableid={'placeholder'} className={'draggable-test'} style={style}>
					<p className={'placeholder-text'} />
				</div>
			);
		}
		return listToRender;
	}

	onScrollChange(droppableActive, scrollOffset) {
		const goingDown = scrollOffset > 0;
		if (droppableActive != null && droppableActive === this.state.droppableActive && this.scrollBars) {
			if ((goingDown && this.scrollBars.getScrollHeight() <= this.scrollBars.getScrollTop()) || (!goingDown && this.scrollBars.getScrollTop() <= 0)) {
				return;
			}
			this.scrollBars.scrollTop(this.scrollBars.getScrollTop() + scrollOffset);
		}
	}

	render() {
		const {children, customScrollbars} = this.props;
		// Objects we want to render
		let listToRender = [];
		const propsObject = {
			key: this.props.droppableId,
			droppableid: this.props.droppableId,
			droppablegroup: this.props.dragAndDropGroup
		};

		if (children && children.length > 0) {
			// Pass my droppableId to all children to give a source for DnD
			let childrenWithProps = React.Children.map(children, child =>
				React.cloneElement(child, {
					droppableId: this.props.droppableId
					//alwaysRender: this.getShouldAlwaysRender
				})
			);
			listToRender = childrenWithProps;
		}
		const optimism = 25;
		let elemHeight = 0;
		let rowsTotalHeight = 0;
		let shouldScroll = true;
		let calculatedRowMinHeight = 0;
		const listHeaderHeight = this.props.listHeader != null ? this.props.listHeaderHeight : 0;
		let outerContainerHeight = this.props.containerHeight;
		elemHeight = this.props.hideList ? 0 : this.props.dynamicElemHeight ? this.props.minElemHeight : this.props.elemHeight;
		rowsTotalHeight = listToRender.length * elemHeight;
		// Container smaller than calculated height of rows?
		shouldScroll = this.props.dynamicElemHeight || this.props.containerHeight <= rowsTotalHeight + listHeaderHeight + optimism;

		// Total rows + height of one row (required for DnD to empty lists/dropping below list)
		calculatedRowMinHeight = rowsTotalHeight + (this.props.hideList ? 0 : elemHeight);

		// The minimum height of the container is the # of elements + 1 (same reason as above), unless a minimum height is specificied that is larger than this.
		// If the minimum height exceeds the containerHeight, we limit it to containerHeight and enable scroll instead
		outerContainerHeight = this.props.enforceContainerMinHeight
			? this.props.containerHeight
			: shouldScroll
			? this.props.containerHeight
			: this.props.containerMinHeight && this.props.containerMinHeight >= calculatedRowMinHeight
			? this.props.containerMinHeight
			: Math.min(calculatedRowMinHeight + listHeaderHeight, this.props.containerHeight);

		const draggedElemId = this.state.currentlyActiveDraggable ? this.state.currentlyActiveDraggable.draggableId : null;
		const CustomTag = this.props.tagName ? this.props.tagName : 'div';
		const headerWithProps =
			this.props.listHeader != null && this.props.listHeaderHeight != null
				? React.cloneElement(this.props.listHeader, {
						draggableid: this.props.droppableId + '-header'
				  })
				: null;
		const isActive = this.state.droppableActive && this.state.droppableActive === this.props.droppableId;
		const headerActive = isActive && this.state.placeholder && this.state.placeholder.includes('header');

		return (
			<CustomTag {...propsObject} style={{height: outerContainerHeight, minHeight: outerContainerHeight, maxHeight: outerContainerHeight, overflow: 'hidden'}}>
				<div className={'header-wrapper ' + (headerActive ? this.props.activeHeaderClass : '')}>{headerWithProps}</div>
				{this.props.hideList ? null : shouldScroll && !this.props.disableScroll ? (
					this.props.dynamicElemHeight ? (
						<DynamicVirtualizedScrollbar
							elemOverScan={this.props.elemOverScan}
							initialElemsToRender={this.props.initialElemsToRender}
							disableVirtualization={this.props.disableVirtualization}
							listLength={listToRender.length}
							minElemHeight={this.props.minElemHeight}
							stickyElems={draggedElemId ? [draggedElemId] : []}
							ref={scrollDiv => (this.scrollBars = scrollDiv)}
							containerHeight={this.props.containerHeight - listHeaderHeight}
							showIndicators={this.props.showIndicators}
							scrollProps={this.props.scrollProps}
						>
							{isActive ? this.pushPlaceholder(listToRender) : listToRender}
						</DynamicVirtualizedScrollbar>
					) : (
						<VirtualizedScrollBar
							disableVirtualization={this.props.disableVirtualization}
							stickyElems={draggedElemId ? [draggedElemId] : []}
							staticElemHeight={elemHeight}
							ref={scrollDiv => (this.scrollBars = scrollDiv)}
							customScrollbars={customScrollbars}
							containerHeight={this.props.containerHeight - listHeaderHeight}
							onScroll={this.props.onScroll}
						>
							{isActive ? this.pushPlaceholder(listToRender) : listToRender}
						</VirtualizedScrollBar>
					)
				) : (
					<div className={'no-scroll-container'}>{isActive ? this.pushPlaceholder(listToRender) : listToRender}</div>
				)}
			</CustomTag>
		);
	}
}

Droppable.propTypes = {
	droppableId: PropTypes.string.isRequired,
	dragAndDropGroup: PropTypes.string.isRequired,
	containerHeight: PropTypes.number.isRequired,
	placeholderStyle: PropTypes.object,
	elemHeight: PropTypes.number,
	dynamicElemHeight: PropTypes.bool,
	disableScroll: PropTypes.bool
};
export default Droppable;
