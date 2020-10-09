import { parseDistro } from '../getPlatform'

const tests = [
  {
    name: 'simple',
    content: `
ID=debian
  `,
    expect: 'debian',
  },
  {
    name: 'simple with quotes',
    content: `
ID="debian"
  `,
    expect: 'debian',
  },
  {
    name: 'debian',
    content: `
PRETTY_NAME="Debian GNU/Linux 10 (buster)"
NAME="Debian GNU/Linux"
VERSION_ID="10"
VERSION="10 (buster)"
VERSION_CODENAME=buster
ID=debian
  `,
    expect: 'debian',
  },
  {
    name: 'ubuntu',
    content: `
NAME="Ubuntu"
VERSION="18.04.3 LTS (Bionic Beaver)"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 18.04.3 LTS"
VERSION_ID="18.04"
VERSION_CODENAME=bionic
UBUNTU_CODENAME=bionic
  `,
    expect: 'debian',
  },
  {
    name: 'amazon linux 1',
    content: `
NAME="Amazon Linux AMI"
VERSION="2018.03"
ID="amzn"
ID_LIKE="rhel fedora"
VERSION_ID="2018.03"
PRETTY_NAME="Amazon Linux AMI 2018.03"
ANSI_COLOR="0;33"
CPE_NAME="cpe:o:amazon:linux:2018.03:ga"
  `,
    expect: 'rhel',
  },
  {
    name: 'amazon linux 2',
    content: `
NAME="Amazon Linux"
VERSION="2"
ID="amzn"
ID_LIKE="centos rhel fedora"
VERSION_ID="2"
PRETTY_NAME="Amazon Linux 2"
ANSI_COLOR="0;33"
CPE_NAME="cpe:2.3:o:amazon:amazon_linux:2"
  `,
    expect: 'rhel',
  },
  {
    name: 'centos',
    content: `
NAME="CentOS Linux"
VERSION="8 (Core)"
ID="centos"
ID_LIKE="rhel fedora"
VERSION_ID="8"
PLATFORM_ID="platform:el8"
  `,
    expect: 'rhel',
  },
  {
    name: 'fedora',
    content: `
NAME=Fedora
VERSION="31 (Container Image)"
ID=fedora
VERSION_ID=31
VERSION_CODENAME=""
PLATFORM_ID="platform:f31"
PRETTY_NAME="Fedora 31 (Container Image)"
ANSI_COLOR="0;34"
LOGO=fedora-logo-icon
  `,
    expect: 'rhel',
  },
  {
    name: 'arch linux',
    content: `
NAME="Arch Linux"
PRETTY_NAME="Arch Linux"
ID=arch
BUILD_ID=rolling
ANSI_COLOR="0;36"
LOGO=archlinux
  `,
    expect: undefined, // this will default to debian later.
  },
  {
    name: 'linux mint',
    content: `
NAME="Linux Mint"
VERSION="18.2 (Sonya)"
ID=linuxmint
ID_LIKE=ubuntu
PRETTY_NAME="Linux Mint 18.2"
VERSION_ID="18.2"
VERSION_CODENAME=sonya
UBUNTU_CODENAME=xenial
  `,
    expect: 'debian',
  },
]

describe('parseDistro', () => {
  for (const t of tests) {
    test(t.name, () => {
      const actual = parseDistro(t.content)
      expect(actual).toBe(t.expect)
    })
  }
})
