class Complex {
  constructor(re, im) {
    this.re = re;
    this.im = im;
  }
}

const math = {
  complex: (re, im) => new Complex(re, im)
}

const meta = {
  operator: {
    binary: {
      '+': (lhs, rhs) => math.complex(lhs.re + rhs.re, lhs.im + rhs.im),
      '*': (lhs, rhs) => math.complex(lhs.re * rhs.re - lhs.im * rhs.im, lhs.re * rhs.im + lhs.im * rhs.re),
    },
    unary: {
      '~': lhs => math.complex(lhs.re, -lhs.im)
    }
  }
};

Object.defineProperty(Complex.prototype, '__EllxMeta__', { value: meta })

export default math;
