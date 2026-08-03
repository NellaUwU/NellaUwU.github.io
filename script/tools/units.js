import { loadURLQuery, materialIcon } from "/script/shared.js";
const MetricUnits = [
    {
        name: "Pico",
        unit: "p",
        mult: -12
    },
    {
        name: "Nano",
        unit: "n",
        mult: -9
    },
    {
        name: "Micro",
        unit: "μ",
        mult: -6
    },
    {
        name: "Mili",
        unit: "m",
        mult: -3
    },
    {
        name: "Centi",
        unit: "c",
        mult: -2
    },
    {
        name: "Deci",
        unit: "d",
        mult: -1
    },
    {
        name: "DEFAULT",
        unit: "",
        mult: 0
    },
    {
        name: "Deca",
        unit: "da",
        mult: 1
    },
    {
        name: "Hecto",
        unit: "h",
        mult: 2
    },
    {
        name: "Kilo",
        unit: "k",
        mult: 3
    },
    {
        name: "Mega",
        unit: "M",
        mult: 6
    },
    {
        name: "Giga",
        unit: "G",
        mult: 9
    },
    {
        name: "Tera",
        unit: "T",
        mult: 12
    }
]
const UnitsLength = [
    {
        name: "Meter",
        unit: "m",
        metric: true,
        default: true
    },
    {
        name: "Mile",
        unit: "mi",
        mult: 0.0006213712
    },
    {
        name: "Yard",
        unit: "yd",
        mult: 1.0936132983
    },
    {
        name: "Foot",
        unit: "ft",
        mult: 3.280839895
    },
    {
        name: "Inch",
        unit: "″",
        mult: 39.37007874
    },
    {
        name: "Light Year",
        unit: "ly",
        mult: 1.057008707E-16
    }
];
const UnitsContent = [];
const UnitsVolume = [];
const UnitsWeigth = [];
const UnitsTemp = [
    {
        name: "Celsius",
        unit: "°C",
        default: true
    },
    {
        name: "Fahrenheit",
        unit: "°F",
        mult: 1.8,
        add: 32,
        multiplyFirst: true
    },
    {
        name: "Kelvin",
        unit: "K",
        add: 273.15
    }
];
const UnitsAngle = [];
const UnitsNumber = [];
function init() {
    // switch (loadURLQuery("type")) {
        //     case null: {
            //         wrapper.appendChild(addLinkBtn("Lenght"));
            //         break;
            //     }
            // }
    const wrapper = document.createElement("div");
    wrapper.appendChild(addInputs(UnitsLength, "Distance"));
    document.querySelector("body").appendChild(wrapper);
}
function addInputs(units, categoryName, categoryIcon) {
    const wrap = document.createElement("div");
    wrap.classList.add("category", "category-" + categoryName.toLowerCase());
    units.forEach(unit => {
        if (unit.metric) {
            MetricUnits.forEach((metric) => {
                wrap.appendChild(addInput(metric.unit + unit.unit, metric.name + unit.name));
            });
        } else {
            wrap.appendChild(addInput(unit.unit, unit.name));
        }
    });
    return wrap;
}
function addInput(unit, name, type = "number") {
    const res = document.createElement("div");
    const input = document.createElement("input");
    const label = document.createElement("p");
    res.classList.add("unit");
    input.type = type;
    label.textContent = unit;
    //res.appendChild(materialIcon(icon));
    res.appendChild(input);
    res.appendChild(label);
    return res;
}
init();