# Readme

# About the Codebase

The whole codebase is written in plain jane vanilla javascript. There is only one dependency [Markdown-it](https://markdown-it.github.io/) for markdown parsing.

#### Handwritten Libraries Canvas runs on

- [chowk.js](./chowk.js) is a reactive library that implements an extremely rudimentary reactive system using signals. 

- [dom.js](./dom.js) To make dom elements from nested Arrays.

- [drag.js](./drag.js) For all your dragging needs.

#### Application files

- [script.js](./script.js) where all the magic happens

- [state.js](./state.js) stores the state of the program

# dom.js

dom.js exports a single function → dom

```
            ,    _
           /|   | |
         _/_\_  >_<
        .-\-/.   |
       /  | | \_ |
       \ \| |\__(/
       /(`---')  |
      / /     \  |
   _.'  \'-'  /  |
   `----'`=-='   '    

```
# script.js

This is where all the magic happens. It is currently a total mess, but will update this block soon once I clean up a bit in there.

```
dom('h1', 'hello world')
```

Makes

```
<h1>hello world</h1>
```

```
     ,.
 __.'_
|__|__|
|     |      
|-___-|
'.___.'
```
# drag.js

For all your dragging needs. Takes in an element and then initializes pointer events to perform drags. By default updates top and left position, or optionally takes in a ```set_left``` and ```set_top``` functions to manually perform the drag.

```
    |\__/,|   (`\
  _.|o o  |_   ) )
-(((---(((--------
```

# chowk.js

_A chowk is an intersection where two or more roads meet._

This file contains the bare minimum reactive system. To create a reactive value use ```reactive```

```
let dog = reactive('bog')
```

And then do something everytime this value changes

```
dog.subscribe((new_value) => {
  // do something with new value
})
```

To wrap multiple subscriptions you can use a memo

```
let dog = reactive('bark')
let cat = reactive('meow')

memo(() => {
// do something everytime
// dog or cat changes
}, [dog, cat])
```

The whole implementation is less than 70 lines.

If you're interested in making one yourself take a look at [this tutorial](https://dev.to/ryansolid/building-a-reactive-library-from-scratch-1i0p)

```
    _______
   /        /.
  /        //
 /______//
(______(/
```

# state.js

All the state is located in this file. The main state of the canvas is the variable ```store```. Which implements [JSON Canvas Spec](https://jsoncanvas.org/spec/1.0/).

The store is basically a naked [reactive](https://are.na/block/42403497) value. Elements that want to be notified when values here change add a subscription function to ```dataSubscriptions``` array. This runs every time a function manually calls ```save_data```.

Other relevant variables such as the ```transforms``` and current ```dotcanvas``` block and ```authslug``` is initialized and stored here too.
