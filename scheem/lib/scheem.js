var Guard, Parser, ScheemError, define, evalAST, evalScheem, forms, initialEnv, isA, isFunction, isNumber, isString, lookup, map, primitives, print, reduce, update, _,
  __slice = [].slice;

Parser = require("./scheem-parser").parser;

ScheemError = require("./scheem/error");

print = require("./scheem/print");

_ = require("underscore");

Guard = {
  getClass: function(object) {
    return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
  },
  expect: function(cond, message) {
    if (!cond) {
      throw new ScheemError(message);
    }
    return Guard;
  },
  expectCount: function(count, params) {
    return Guard.expect(params.length === count, "" + params.length + " params found where " + count + " expected.");
  },
  expectMinCount: function(count, params) {
    return Guard.expect(params.length >= count, "" + params.length + " params found where at least " + count + " expected.");
  },
  expectMaxCount: function(count, params) {
    return Guard.expect(params.length <= count, "" + params.length + " params found where no more than " + count + " expected.");
  },
  expectList: function(thing) {
    var thingClass;
    thingClass = Guard.getClass(thing);
    return Guard.expect(thingClass === "Array", thingClass + " found where a list was expected.");
  }
};

isA = function(type) {
  return function(expr) {
    return typeof expr === type;
  };
};

isNumber = isA("number");

isString = isA("string");

isFunction = isA("function");

lookup = function(env, sym) {
  if (env.bindings[sym] != null) {
    return env.bindings[sym];
  } else if (env.outer != null) {
    return lookup(env.outer, sym);
  } else {
    throw new ScheemError("Reference to uninitialized var " + sym + ".");
  }
};

define = function(env, sym, val) {
  if (env.bindings[sym] != null) {
    throw new ScheemError("Attempt to reinitialize already initialized var " + sym + ".");
  } else {
    return env.bindings[sym] = val;
  }
};

update = function(env, sym, val) {
  if (env.bindings[sym] != null) {
    env.bindings[sym] = val;
    return null;
  } else if (env.outer != null) {
    return update(env.outer, sym, val);
  } else {
    throw new ScheemError("Attempt to update uninitialized var " + sym + ".");
  }
};

map = function(fn, coll) {
  var thing, _i, _len, _results;
  _results = [];
  for (_i = 0, _len = coll.length; _i < _len; _i++) {
    thing = coll[_i];
    _results.push(fn(thing));
  }
  return _results;
};

reduce = function(fn, coll) {
  var acc, thing, _i, _len, _ref;
  acc = coll[0];
  _ref = coll.slice(1);
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    thing = _ref[_i];
    acc = fn(acc, thing);
  }
  return acc;
};

forms = {
  begin: function(expr, env) {
    var result, subexpr, _i, _len, _ref;
    _ref = expr.slice(1);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      subexpr = _ref[_i];
      result = evalAST(subexpr, env);
    }
    return result;
  },
  quote: function(expr, env) {
    Guard.expectCount(1, expr.slice(1));
    return expr[1];
  },
  "if": function(expr, env) {
    Guard.expectMinCount(2, expr.slice(1)).expectMaxCount(3, expr.slice(1));
    if (evalAST(expr[1], env) === true) {
      return evalAST(expr[2], env);
    } else if (expr[3] != null) {
      return evalAST(expr[3], env);
    }
  },
  "let": function(expr, env) {
    var assignments, bindings, result, subexpr, x, _i, _j, _len, _ref, _ref1;
    Guard.expectMinCount(2, expr.slice(1));
    assignments = expr[1];
    Guard.expect(function() {
      return _.isArray(assignments) && assignments.length % 2 === 0;
    }, "let requires a list of even length for bindings.");
    bindings = {};
    for (x = _i = 0, _ref = assignments.length; _i < _ref; x = _i += 2) {
      bindings[assignments[x]] = assignments[x + 1];
    }
    env = {
      bindings: bindings,
      outer: env
    };
    _ref1 = expr.slice(2);
    for (_j = 0, _len = _ref1.length; _j < _len; _j++) {
      subexpr = _ref1[_j];
      result = evalAST(subexpr, env);
    }
    return result;
  },
  lambda: function(expr, env) {
    var _body, _vars;
    _vars = expr[1];
    _body = expr.slice(2);
    return function() {
      var bindings, result, subexpr, _arg, _args, _i, _j, _len, _len1, _ref, _ref1, _var;
      _args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      bindings = {};
      _ref = _.zip(_vars, _args);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        _ref1 = _ref[_i], _var = _ref1[0], _arg = _ref1[1];
        bindings[_var] = _arg;
      }
      env = {
        bindings: bindings,
        outer: env
      };
      for (_j = 0, _len1 = _body.length; _j < _len1; _j++) {
        subexpr = _body[_j];
        result = evalAST(subexpr, env);
      }
      return result;
    };
  },
  define: function(expr, env) {
    Guard.expectCount(2, expr.slice(1));
    return define(env, expr[1], evalAST(expr[2], env));
  },
  "set!": function(expr, env) {
    Guard.expectCount(2, expr.slice(1));
    return update(env, expr[1], evalAST(expr[2], env));
  }
};

primitives = {
  "alert": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (window.alert != null) {
      return alert(args.join(", "));
    } else {
      return primitives.puts.apply(primitives, args);
    }
  },
  "puts": function() {
    var arg, args, _i, _len, _results;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    _results = [];
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      _results.push(console.log(arg));
    }
    return _results;
  },
  "length": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(1, args);
    return args[0].length;
  },
  "empty?": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(1, args);
    return args[0].length === 0;
  },
  "+": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectMinCount(1, args);
    return reduce(function(acc, n) {
      return acc + n;
    }, args);
  },
  "-": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectMinCount(1, args);
    if (args.length === 1) {
      return 0 - args[0];
    } else {
      return reduce(function(acc, n) {
        return acc - n;
      }, args);
    }
  },
  "*": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectMinCount(2, args);
    return reduce(function(acc, n) {
      return acc * n;
    }, args);
  },
  "/": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectMinCount(2, args);
    return reduce(function(acc, n) {
      return acc / n;
    }, args);
  },
  "=": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(2, args);
    return args[0] === args[1];
  },
  "<": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(2, args);
    return args[0] < args[1];
  },
  "<=": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(2, args);
    return args[0] <= args[1];
  },
  ">": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(2, args);
    return args[0] > args[1];
  },
  ">=": function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(2, args);
    return args[0] >= args[1];
  },
  cons: function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(2, args).expectList(args[1]);
    return [args[0]].concat(args[1]);
  },
  car: function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(1, args).expectList(args[0]);
    return args[0][0];
  },
  cdr: function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    Guard.expectCount(1, args).expectList(args[0]);
    return args[0].slice(1);
  },
  list: function() {
    var args;
    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return args;
  }
};

initialEnv = function() {
  return {
    outer: null,
    bindings: _.clone(primitives)
  };
};

evalScheem = function(code, env) {
  var ast;
  if (env == null) {
    env = initialEnv();
  }
  try {
    ast = Parser.parse(code);
    return evalAST(ast, env);
  } catch (e) {
    if (e instanceof Parser.SyntaxError) {
      e.message = "Syntax error at line " + e.line + ", column " + e.column + ".";
    }
    throw e;
  }
};

evalAST = function(expr, env) {
  var arg, args, fn;
  if (isNumber(expr)) {
    return expr;
  } else if (isString(expr)) {
    return lookup(env, expr);
  } else if (forms[expr[0]] != null) {
    return forms[expr[0]](expr, env);
  } else {
    fn = evalAST(expr[0], env);
    args = (function() {
      var _i, _len, _ref, _results;
      _ref = expr.slice(1);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        arg = _ref[_i];
        _results.push(evalAST(arg, env));
      }
      return _results;
    })();
    return fn.apply(null, args);
  }
};

module.exports = {
  Error: ScheemError,
  Parser: Parser,
  print: print,
  evalScheem: evalScheem
};
